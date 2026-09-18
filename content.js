// ============================================================
// FocusMap НГУ — Социальное голосование за статус аудиторий
// ============================================================

(async function () {
  'use strict';
  
  console.log('[FocusMap] 🚀 Скрипт начал выполнение');

  // Проверка загрузки библиотеки
  if (!window.supabase) {
    console.error('[FocusMap] ❌ ОШИБКА: window.supabase не определён!');
    return;
  }
  console.log('[FocusMap] ✅ Supabase библиотека загружена');

  // Конфигурация 
  const CONFIG = {
    supabaseUrl: 'https://rfksyolvmrlnsdfapely.supabase.co',
    supabaseKey: 'sb_publishable_CLuAjYS9sOAECkqTSsqlXw_Gps5vIcN', // <-- Убедитесь, что это ваш ключ
    refreshIntervalMs: 30_000,
  };

  // Инициализация клиента
  let supabaseClient;
  try {
    supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
    console.log('[FocusMap] ✅ Supabase клиент инициализирован');
  } catch (err) {
    console.error('[FocusMap] ❌ Ошибка инициализации:', err);
    return;
  }

  // Глобальные переменные
  let currentRooms = [];
  let overlay = null;
  let sidebar = null;
  let addMode = false; // ЕДИНСТВЕННОЕ объявление addMode

  // ==========================================
  // 1. ПОИСК И ПОДГОТОВКА КАРТЫ
  // ==========================================
  function prepareMapContainer() {
    const imgSelectors = ['img[src*="Plan"]', 'img[src*="plan"]', 'img[src*="Map"]', 'img[src*="map"]', 'img[src*="nsu"]'];
    for (const selector of imgSelectors) {
      const el = document.querySelector(selector);
      if (el && el.offsetWidth > 300 && el.offsetHeight > 300) { 
        return wrapIfNeeded(el);
      }
    }
    const svg = document.querySelector('svg');
    if (svg && svg.offsetWidth > 300 && svg.offsetHeight > 300) return wrapIfNeeded(svg);
    
    const images = Array.from(document.querySelectorAll('img'));
    if (images.length > 0) {
      const largestImage = images.reduce((max, img) => (img.offsetWidth * img.offsetHeight > max.offsetWidth * max.offsetHeight ? img : max));
      if (largestImage.offsetWidth > 300 && largestImage.offsetHeight > 300) return wrapIfNeeded(largestImage);
    }
    return null;
  }

  function wrapIfNeeded(element) {
    if (element.tagName === 'IMG' || element.tagName === 'svg') {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = `position: relative; display: inline-block; width: ${element.offsetWidth}px; height: ${element.offsetHeight}px;`;
      element.parentNode.insertBefore(wrapper, element);
      wrapper.appendChild(element);
      element.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';
      return wrapper;
    }
    if (getComputedStyle(element).position === 'static') element.style.position = 'relative';
    return element;
  }

  // ==========================================
  // 2. ИНТЕРФЕЙС (САЙДБАР И МАРКЕРЫ)
  // ==========================================
  function createSidebar() {
    document.getElementById('focusmap-sidebar')?.remove();
    sidebar = document.createElement('div');
    sidebar.id = 'focusmap-sidebar';
    sidebar.style.cssText = `position: fixed; top: 20px; right: 20px; width: 300px; max-height: 80vh; background: white; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 99999; overflow-y: auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`;
    
    const header = document.createElement('div');
    header.style.cssText = `padding: 16px; background: #2563eb; color: white; border-radius: 12px 12px 0 0; font-weight: bold; font-size: 16px;`;
    header.textContent = '📊 Статус рекреаций';
    sidebar.appendChild(header);

    const list = document.createElement('div');
    list.id = 'focusmap-room-list';
    list.style.padding = '12px';
    sidebar.appendChild(list);
    document.body.appendChild(sidebar);
  }

  function updateRoomList() {
    const list = document.getElementById('focusmap-room-list');
    if (!list) return;
    list.innerHTML = '';
    if (currentRooms.length === 0) {
      list.innerHTML = '<p style="color: #6b7280; text-align: center;">Нет данных об рекреациях</p>';
      return;
    }
    currentRooms.forEach(room => {
      const item = document.createElement('div');
      item.style.cssText = `padding: 12px; margin-bottom: 8px; background: #f9fafb; border-radius: 8px; border-left: 4px solid ${getStatusColor(room.status)};`;
      
      const title = document.createElement('div');
      title.style.cssText = 'font-weight: bold; margin-bottom: 8px;';
      title.textContent = `Рек. ${room.number}`;
      item.appendChild(title);

      const buttons = document.createElement('div');
      buttons.style.cssText = 'display: flex; gap: 4px;';
      [{ key: 'quiet', label: '🟢 Тихо', color: '#22c55e' }, { key: 'noisy', label: '🟡 Шумно', color: '#eab308' }, { key: 'busy', label: '🔴 Занято', color: '#ef4444' }].forEach(s => {
        const btn = document.createElement('button');
        btn.textContent = s.label;
        btn.style.cssText = `flex: 1; padding: 6px 8px; border: none; border-radius: 4px; background: ${room.status === s.key ? s.color : '#e5e7eb'}; color: ${room.status === s.key ? 'white' : '#374151'}; cursor: pointer; font-size: 11px; transition: all 0.2s;`;
        btn.onmouseover = () => btn.style.opacity = '0.8';
        btn.onmouseout = () => btn.style.opacity = '1';
        btn.onclick = () => voteForRoom(room.id, s.key);
        buttons.appendChild(btn);
      });
      item.appendChild(buttons);
      list.appendChild(item);
    });
  }

  function renderMarkers() {
    const container = prepareMapContainer();
    if (!container) { console.warn('[FocusMap] ⚠️ Контейнер карты не найден'); return; }
    document.getElementById('focusmap-overlay')?.remove();
    overlay = document.createElement('div');
    overlay.id = 'focusmap-overlay';
    overlay.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999;';
    container.appendChild(overlay);

    currentRooms.forEach(room => {
      if (room.x && room.y) {
        const marker = document.createElement('div');
        marker.className = 'focusmap-marker';
        marker.dataset.roomId = room.id;
        marker.style.cssText = `position: absolute; left: ${room.x}%; top: ${room.y}%; width: 20px; height: 20px; border-radius: 50%; background: ${getStatusColor(room.status)}; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: pointer; pointer-events: auto; transition: transform 0.2s;`;
        marker.title = `Рек. ${room.number}: ${getStatusText(room.status)}`;
        marker.onmouseover = () => marker.style.transform = 'scale(1.3)';
        marker.onmouseout = () => marker.style.transform = 'scale(1)';
        
        marker.onclick = (e) => {
          e.stopPropagation();
          if (addMode) {
            // В режиме добавления показываем меню действий
            showMarkerActionsMenu(marker, room.id);
          } else {
            // В обычном режиме показываем popup голосования
            showRoomPopup(room, marker);
          }
        };
        
        overlay.appendChild(marker);
      }
    });
    console.log(`[FocusMap] 🎉 Отрисовано ${currentRooms.filter(r => r.x && r.y).length} маркеров`);
  }

  function showRoomPopup(room, anchor) {
    document.getElementById('focusmap-popup')?.remove();
    const popup = document.createElement('div');
    popup.id = 'focusmap-popup';
    popup.style.cssText = 'position: fixed; background: white; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); padding: 16px; z-index: 99999; font-family: -apple-system, BlinkMacSystemFont, sans-serif; min-width: 200px;';
    const rect = anchor.getBoundingClientRect();
    popup.style.top = `${rect.bottom + 8}px`;
    popup.style.left = `${rect.left}px`;
    popup.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 12px; font-size: 16px;">Рек. ${room.number}</div>
      <div style="margin-bottom: 12px; color: #6b7280; font-size: 14px;">Статус: <strong style="color: ${getStatusColor(room.status)}">${getStatusText(room.status)}</strong></div>
      <div style="display: flex; gap: 8px;">
        <button data-status="quiet" style="flex: 1; padding: 8px; border: none; border-radius: 6px; background: #22c55e; color: white; cursor: pointer;">🟢 Тихо</button>
        <button data-status="noisy" style="flex: 1; padding: 8px; border: none; border-radius: 6px; background: #eab308; color: white; cursor: pointer;">🟡 Шумно</button>
        <button data-status="busy" style="flex: 1; padding: 8px; border: none; border-radius: 6px; background: #ef4444; color: white; cursor: pointer;">🔴 Занято</button>
      </div>`;
    document.body.appendChild(popup);
    popup.querySelectorAll('button[data-status]').forEach(btn => {
      btn.onclick = async () => { await voteForRoom(room.id, btn.dataset.status); popup.remove(); };
    });
    setTimeout(() => {
      const handler = (e) => { if (!popup.contains(e.target) && e.target !== anchor) { popup.remove(); document.removeEventListener('click', handler); } };
      document.addEventListener('click', handler);
    }, 100);
  }

  // ==========================================
  // 3. ЛОГИКА ГОЛОСОВАНИЯ И РЕЙТИНГА
  // ==========================================
  async function voteForRoom(roomId, status) {
    console.log(`[FocusMap] 🗳 Голосование: рекреация ${roomId} -> ${status}`);
    chrome.storage.local.get(['focusmap_user_id', 'focusmap_user_nickname'], async (result) => {
      const userId = result.focusmap_user_id;
      if (!userId) { alert('⚠️ Сначала зарегистрируйтесь или войдите через иконку расширения!'); return; }

      try {
        const { data: userProfile } = await supabaseClient.from('users').select('reputation').eq('id', userId).single();
        const userReputation = userProfile?.reputation || 5.00;
        
        if (userReputation < 3.00) { alert(`⚠️ Ваш рейтинг слишком низкий (${userReputation.toFixed(2)}). Голосуйте точнее!`); return; }
        const voteWeight = userReputation / 5.00;

        const { error: voteError } = await supabaseClient.from('votes').insert({ room_id: roomId, user_id: userId, status: status, weight: voteWeight, created_at: new Date().toISOString() });
        if (voteError) throw voteError;

        await supabaseClient.from('rooms').update({ status: status }).eq('id', roomId);
        console.log('[FocusMap] ✅ Голос записан и статус обновлён!');

        const roomIndex = currentRooms.findIndex(r => r.id === roomId);
        if (roomIndex !== -1) { currentRooms[roomIndex].status = status; renderMarkers(); updateRoomList(); }
        setTimeout(() => recalcRoomStatus(roomId), 300_000);
      } catch (err) { console.error('[FocusMap] ❌ Ошибка:', err); }
    });
  }

  async function recalcRoomStatus(roomId) {
    try {
      const { data: votes, error } = await supabaseClient.from('votes').select('status, user_id, weight').eq('room_id', roomId).gte('created_at', new Date(Date.now() - 3600_000).toISOString()).order('created_at', { ascending: false });
      if (error || !votes || votes.length === 0) return;

      const weightedCounts = { quiet: 0, noisy: 0, busy: 0 };
      votes.forEach(v => { if (weightedCounts[v.status] !== undefined) weightedCounts[v.status] += (v.weight || 1.0); });
      const newStatus = Object.entries(weightedCounts).sort((a, b) => b[1] - a[1])[0][0];
      
      await supabaseClient.from('rooms').update({ status: newStatus }).eq('id', roomId);
      await updateUsersRatings(roomId, votes, newStatus);
    } catch (err) { console.error('[FocusMap] ❌ Ошибка пересчёта:', err); }
  }

  async function updateUsersRatings(roomId, votes, finalStatus) {
    for (const vote of votes) {
      const isCorrect = vote.status === finalStatus;
      let reputationChange = isCorrect ? 0.02 : 0;
      if (!isCorrect) {
        const severityDiff = Math.abs(({ quiet: 1, noisy: 2, busy: 3 }[finalStatus] || 1) - ({ quiet: 1, noisy: 2, busy: 3 }[vote.status] || 1));
        reputationChange = severityDiff === 1 ? -0.10 : -0.25;
      }
      
      const { data: userData } = await supabaseClient.from('users').select('reputation').eq('id', vote.user_id).single();
      const newReputation = Math.max(0.00, Math.min(5.00, (userData?.reputation || 5.00) + reputationChange));
      
      await supabaseClient.from('users').update({ 
        reputation: newReputation,
        total_votes: supabase.raw('total_votes + 1'),
        correct_votes: supabase.raw(`correct_votes + ${isCorrect ? 1 : 0}`)
      }).eq('id', vote.user_id);
    }
  }

  // ==========================================
  // 4. ЗАГРУЗКА ДАННЫХ
  // ==========================================
  function getCurrentBuilding() {
    const url = window.location.href;
    if (url.includes('rektorat') || url.includes('2237729')) return 1;
    if (url.includes('Uchebniy-korpus-n1') || url.includes('2237723')) return 2;
    if (url.includes('glavniy-korpus') || url.includes('2237735')) return 3;
    return 1;
  }

  function getCurrentFloor() {
    const floorButtons = document.querySelectorAll('button, .btn, [class*="floor"], [class*="этаж"]');
    for (const btn of floorButtons) {
      const style = window.getComputedStyle(btn);
      const text = btn.textContent.trim();
      if ((style.backgroundColor.includes('220') || style.backgroundColor.includes('rgb(220') || style.backgroundColor === 'red' || btn.classList.contains('active') || btn.style.backgroundColor === 'red') && text.match(/^\d+\s*(этаж|ЭТАЖ)?$/i)) {
        return parseInt(text.match(/(\d+)/)[1]);
      }
    }
    const headings = document.querySelectorAll('h1, h2, h3, .floor-title, .page-title');
    for (const h of headings) {
      const match = h.textContent.match(/(\d+)\s*(этаж|ЭТАЖ|floor)/i);
      if (match) return parseInt(match[1]);
    }
    const floorMatch = document.body.innerHTML.match(/(\d+)\s*ЭТАЖ/i);
    if (floorMatch) return parseInt(floorMatch[1]);
    if (document.title.toLowerCase().includes('цоколь')) return 0;
    return 0;
  }

  async function loadRooms() {
    try {
      const currentFloor = getCurrentFloor();
      const currentBuilding = getCurrentBuilding();
      console.log(`[FocusMap] 🏢 Загрузка: Корпус ${currentBuilding}, Этаж ${currentFloor}`);
      
      let query = supabaseClient.from('rooms').select('*').eq('building', currentBuilding);
      if (currentFloor >= 0) query = query.eq('floor', currentFloor);
      
      const { data, error } = await query.order('number');
      if (error) { console.error('[FocusMap] ❌ Ошибка загрузки:', error); return []; }
      return data || [];
    } catch (err) { console.error('[FocusMap] ❌ Ошибка:', err); return []; }
  }

  async function loadAndRender() {
    currentRooms = await loadRooms();
    renderMarkers();
    createSidebar();
    updateRoomList();
    updateAddModeUI(); // Обновляем UI режима добавления после перерисовки
  }

  // ==========================================
  // 5. 🔥 РЕЖИМ ДОБАВЛЕНИЯ (СТАБИЛЬНАЯ ВЕРСИЯ)
  // ==========================================
  function updateAddModeUI() {
    const mapContainer = document.querySelector('#focusmap-overlay')?.parentElement;
    if (addMode) {
      if (mapContainer) mapContainer.style.cursor = 'crosshair';
      createAddModePanel();
      document.querySelectorAll('.focusmap-marker').forEach(marker => {
        marker.style.cursor = 'grab';
        marker.title = 'Кликните для перемещения или удаления';
      });
    } else {
      if (mapContainer) mapContainer.style.cursor = '';
      document.getElementById('focusmap-add-panel')?.remove();
      document.getElementById('focusmap-add-dialog')?.remove();
      document.getElementById('focusmap-marker-menu')?.remove();
      document.querySelectorAll('.focusmap-marker').forEach(marker => {
        marker.style.cursor = 'pointer';
        const room = currentRooms.find(r => r.id == marker.dataset.roomId);
        marker.title = room ? `Рек. ${room.number}: ${getStatusText(room.status)}` : 'Рекреация';
      });
    }
  }

  function createAddModePanel() {
    if (document.getElementById('focusmap-add-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'focusmap-add-panel';
    panel.style.cssText = `position: fixed; top: 20px; left: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 20px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.3); z-index: 100000; font-family: sans-serif; max-width: 320px; animation: slideIn 0.3s ease-out;`;
    panel.innerHTML = `
      <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">🎯 Режим добавления активен</div>
      <div style="font-size: 13px; line-height: 1.5; margin-bottom: 12px;">
        <div style="margin-bottom: 6px;">📍 <strong>Клик по пустому месту</strong> — добавить</div>
        <div>✋ <strong>Клик по маркеру</strong> — переместить/удалить</div>
      </div>
      <button id="disable-add-mode-btn" style="width: 100%; padding: 8px; background: rgba(255,255,255,0.2); border: 2px solid white; border-radius: 6px; color: white; font-weight: bold; cursor: pointer;">Выключить режим</button>`;
    
    if (!document.getElementById('anim-slideIn')) {
      const style = document.createElement('style'); style.id = 'anim-slideIn'; style.textContent = `@keyframes slideIn { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
      document.head.appendChild(style);
    }
    document.body.appendChild(panel);
    document.getElementById('disable-add-mode-btn').onclick = () => toggleAddMode(false);
  }

  document.addEventListener('click', (e) => {
    if (!addMode) return;
    const mapContainer = document.querySelector('#focusmap-overlay')?.parentElement;
    if (!mapContainer) return;

    if (e.target.closest('#focusmap-add-panel') || e.target.closest('#focusmap-add-dialog') || e.target.closest('#focusmap-marker-menu') || e.target.closest('#focusmap-popup')) return;

    // Клик по пустому месту карты — добавляем новую аудиторию
    if (e.target === mapContainer || mapContainer.contains(e.target)) {
      e.stopPropagation();
      const rect = mapContainer.getBoundingClientRect();
      showAddRoomDialog(((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100, mapContainer);
    }
  });

  function showAddRoomDialog(x, y) {
    if (document.getElementById('focusmap-add-dialog')) return;
    const dialog = document.createElement('div');
    dialog.id = 'focusmap-add-dialog';
    dialog.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 24px; border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,0.3); z-index: 100001; font-family: sans-serif; min-width: 320px; animation: popIn 0.2s ease-out;`;
    
    if (!document.getElementById('anim-popIn')) {
      const style = document.createElement('style'); style.id = 'anim-popIn'; style.textContent = `@keyframes popIn { from { transform: translate(-50%, -50%) scale(0.8); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }`;
      document.head.appendChild(style);
    }

    dialog.innerHTML = `
      <div style="font-size: 20px; font-weight: bold; margin-bottom: 16px;">📍 Новая рекреация</div>
      <div style="background: #f3f4f6; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; color: #6b7280;">Координаты: <strong>x=${x.toFixed(1)}%, y=${y.toFixed(1)}%</strong></div>
      <label style="display: block; margin-bottom: 8px; font-weight: 500;">Номер рекреации:</label>
      <input type="text" id="new-room-number" placeholder="Например: 305" style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; margin-bottom: 16px; box-sizing: border-box; outline: none;">
      <div style="display: flex; gap: 8px;">
        <button id="cancel-add-btn" style="flex: 1; padding: 10px; background: #e5e7eb; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">Отмена</button>
        <button id="confirm-add-btn" style="flex: 2; padding: 10px; background: #22c55e; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; color: white;">Добавить</button>
      </div>`;
    document.body.appendChild(dialog);
    setTimeout(() => document.getElementById('new-room-number').focus(), 100);

    document.getElementById('cancel-add-btn').onclick = () => dialog.remove();
    document.getElementById('confirm-add-btn').onclick = async () => {
      const number = document.getElementById('new-room-number').value.trim();
      if (!number) { alert('Введите номер рекреации!'); return; }
      const { error } = await supabaseClient.from('rooms').insert({ number, building: getCurrentBuilding(), floor: getCurrentFloor(), x: x.toFixed(2), y: y.toFixed(2), status: 'quiet', seats: 0, sockets: false, wifi: false });
      if (error) alert('❌ Ошибка: ' + error.message);
      else { showNotification(`✅ Рекреация ${number} добавлена!`); dialog.remove(); setTimeout(loadAndRender, 500); }
    };
    document.getElementById('new-room-number').addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('confirm-add-btn').click(); });
  }

  function showMarkerActionsMenu(marker, roomId) {
    // 1. Удаляем старое меню, если оно вдруг осталось
    const existingMenu = document.getElementById('focusmap-marker-menu');
    if (existingMenu) existingMenu.remove();

    // 2. Создаем новое меню
    const menu = document.createElement('div');
    menu.id = 'focusmap-marker-menu';
    const rect = marker.getBoundingClientRect();
    menu.style.cssText = `
      position: fixed; top: ${rect.bottom + 8}px; left: ${rect.left}px;
      background: white; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      padding: 12px; z-index: 100001; font-family: sans-serif; min-width: 180px;
      animation: popIn 0.2s ease-out;
    `;
    
    menu.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 12px;">Действия:</div>
      <button id="move-marker-btn" style="width: 100%; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; margin-bottom: 8px; font-weight: 500;">✋ Переместить</button>
      <button id="delete-marker-btn" style="width: 100%; padding: 10px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">🗑 Удалить</button>
    `;
    
    document.body.appendChild(menu);

    // 3. Обработчик кнопки "Переместить"
    document.getElementById('move-marker-btn').onclick = (e) => {
      e.stopPropagation(); // Останавливаем всплытие клика
      menu.remove();
      startDragMode(marker, roomId);
    };

    // 4. Обработчик кнопки "Удалить" (с защитой и логами)
    document.getElementById('delete-marker-btn').onclick = async (e) => {
      e.stopPropagation(); // КРИТИЧЕСКИ ВАЖНО: чтобы клик не закрыл меню раньше времени
      
      console.log('[FocusMap] 🗑 Попытка удаления. ID рекреаций:', roomId);
      
      if (confirm('Вы уверены, что хотите удалить эту рекреацию? Это действие нельзя отменить.')) {
        try {
          // Добавляем .select(), чтобы Supabase вернул данные об удаленной строке (подтверждение успеха)
          const { data, error } = await supabaseClient
            .from('rooms')
            .delete()
            .eq('id', roomId)
            .select(); 

          if (error) {
            console.error('[FocusMap] ❌ Ошибка Supabase при удалении:', error);
            alert('❌ Ошибка удаления: ' + error.message);
          } else {
            console.log('[FocusMap] ✅ Успешно удалено из БД:', data);
            showNotification('✅ Рекреация удалена');
            menu.remove();
            setTimeout(() => loadAndRender(), 500); // Перерисовываем карту через полсекунды
          }
        } catch (err) {
          console.error('[FocusMap] ❌ Критическая ошибка при удалении:', err);
          alert('Критическая ошибка: ' + err.message);
        }
      }
    };

    // 5. Закрытие меню при клике в любое другое место
    setTimeout(() => {
      const closeHandler = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeHandler);
        }
      };
      document.addEventListener('click', closeHandler);
    }, 100);
  }

  function startDragMode(marker, roomId) {
    const mapContainer = marker.closest('#focusmap-overlay')?.parentElement;
    if (!mapContainer) return;
    marker.style.cursor = 'grabbing';
    showNotification('👆 Двигайте мышью, отпустите чтобы зафиксировать');

    const moveHandler = (e) => {
      const rect = mapContainer.getBoundingClientRect();
      marker.style.left = `${Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))}%`;
      marker.style.top = `${Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))}%`;
    };

    const dropHandler = async (e) => {
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', dropHandler);
      const rect = mapContainer.getBoundingClientRect();
      const newX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const newY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      await supabaseClient.from('rooms').update({ x: newX.toFixed(2), y: newY.toFixed(2) }).eq('id', roomId);
      showNotification('✅ Маркер перемещён!');
      setTimeout(loadAndRender, 500);
    };
    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', dropHandler);
  }

  function showNotification(message) {
    document.getElementById('focusmap-notification')?.remove();
    const notif = document.createElement('div');
    notif.id = 'focusmap-notification';
    notif.textContent = message;
    notif.style.cssText = `position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #1f2937; color: white; padding: 12px 24px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 100002; font-family: sans-serif; font-weight: 500; animation: slideUp 0.3s ease-out;`;
    if (!document.getElementById('anim-slideUp')) {
      const style = document.createElement('style'); style.id = 'anim-slideUp'; style.textContent = `@keyframes slideUp { from { transform: translateX(-50%) translateY(100px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }`;
      document.head.appendChild(style);
    }
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
  }

  function toggleAddMode(isEnabled) {
    addMode = isEnabled;
    chrome.storage.local.set({ focusmap_add_mode: isEnabled });
    updateAddModeUI();
    showNotification(isEnabled ? '🎯 Режим добавления включён!' : '🎯 Режим добавления выключен');
  }

  function getStatusColor(status) { return { quiet: '#22c55e', noisy: '#eab308', busy: '#ef4444', unknown: '#9ca3af' }[status] || '#22c55e'; }
  function getStatusText(status) { return { quiet: 'Тихо', noisy: 'Шумно', busy: 'Занято', unknown: 'Неизвестно' }[status] || 'Неизвестно'; }

  // ==========================================
  // 6. ЗАПУСК И ОБРАБОТЧИКИ
  // ==========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndRender);
  } else {
    loadAndRender();
  }
  setInterval(loadAndRender, CONFIG.refreshIntervalMs);

  // Инициализация режима добавления при загрузке
  chrome.storage.local.get(['focusmap_add_mode'], (result) => {
    addMode = result.focusmap_add_mode || false;
    setTimeout(updateAddModeUI, 1000);
  });

  // Слушаем сообщения от popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_ADD_MODE') {
      toggleAddMode(message.enabled);
    }
    sendResponse({ status: 'ok' });
    return true;
  });

})();