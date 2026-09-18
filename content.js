// ============================================================
// FocusMap НГУ — Социальное голосование за статус аудиторий
// ============================================================

(async function () {
  'use strict';
  
  console.log('[FocusMap]  Скрипт начал выполнение');

  // Проверка загрузки библиотеки
  if (!window.supabase) {
    console.error('[FocusMap] ❌ ОШИБКА: window.supabase не определён!');
    return;
  }
  console.log('[FocusMap] ✅ Supabase библиотека загружена');

  // Конфигурация 
  const CONFIG = {
    supabaseUrl: 'https://rfksyolvmrlnsdfapely.supabase.co',       // <-- ЗАМЕНИТЕ
    supabaseKey: 'sb_publishable_CLuAjYS9sOAECkqTSsqlXw_Gps5vIcN',              // <-- ЗАМЕНИТЕ
    refreshIntervalMs: 30_000, // Обновление каждые 10 секунд
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

  // Функция поиска контейнера карты
  function prepareMapContainer() {
    const imgSelectors = [
      'img[src*="Plan"]',
      'img[src*="plan"]',
      'img[src*="Map"]',
      'img[src*="map"]',
      'img[src*="nsu"]'
    ];

    for (const selector of imgSelectors) {
      const el = document.querySelector(selector);
      if (el && el.offsetWidth > 300 && el.offsetHeight > 300) { 
        console.log(`[FocusMap] 🎯 Найдена картинка карты`);
        return wrapIfNeeded(el);
      }
    }

    const svg = document.querySelector('svg');
    if (svg && svg.offsetWidth > 300 && svg.offsetHeight > 300) {
       return wrapIfNeeded(svg);
    }

    const images = Array.from(document.querySelectorAll('img'));
    if (images.length > 0) {
      const largestImage = images.reduce((max, img) => {
        const area = img.offsetWidth * img.offsetHeight;
        const maxArea = max.offsetWidth * max.offsetHeight;
        return area > maxArea ? img : max;
      });

      if (largestImage.offsetWidth > 300 && largestImage.offsetHeight > 300) {
        return wrapIfNeeded(largestImage);
      }
    }

    return null;
  }

  function wrapIfNeeded(element) {
    if (element.tagName === 'IMG' || element.tagName === 'svg') {
      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      wrapper.style.width = element.offsetWidth + 'px';
      wrapper.style.height = element.offsetHeight + 'px';
      
      element.parentNode.insertBefore(wrapper, element);
      wrapper.appendChild(element);
      
      element.style.position = 'absolute';
      element.style.top = '0';
      element.style.left = '0';
      element.style.width = '100%';
      element.style.height = '100%';
      
      return wrapper;
    }
    
    if (getComputedStyle(element).position === 'static') {
      element.style.position = 'relative';
    }
    return element;
  }

  // Создание боковой панели со списком аудиторий
  function createSidebar() {
    document.getElementById('focusmap-sidebar')?.remove();

    sidebar = document.createElement('div');
    sidebar.id = 'focusmap-sidebar';
    sidebar.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      max-height: 80vh;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      z-index: 99999;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px;
      background: #2563eb;
      color: white;
      border-radius: 12px 12px 0 0;
      font-weight: bold;
      font-size: 16px;
    `;
    header.textContent = ' Статус аудиторий';
    sidebar.appendChild(header);

    const list = document.createElement('div');
    list.id = 'focusmap-room-list';
    list.style.padding = '12px';
    sidebar.appendChild(list);

    document.body.appendChild(sidebar);
  }

  // Обновление списка аудиторий
  function updateRoomList() {
    const list = document.getElementById('focusmap-room-list');
    if (!list) return;

    list.innerHTML = '';

    if (currentRooms.length === 0) {
      list.innerHTML = '<p style="color: #6b7280; text-align: center;">Нет данных об аудиториях</p>';
      return;
    }

    currentRooms.forEach(room => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 12px;
        margin-bottom: 8px;
        background: #f9fafb;
        border-radius: 8px;
        border-left: 4px solid ${getStatusColor(room.status)};
      `;

      const title = document.createElement('div');
      title.style.cssText = 'font-weight: bold; margin-bottom: 8px;';
      title.textContent = `Рек. ${room.number}`;
      item.appendChild(title);

      const buttons = document.createElement('div');
      buttons.style.cssText = 'display: flex; gap: 4px;';

      const statuses = [
        { key: 'quiet', label: ' Тихо', color: '#22c55e' },
        { key: 'noisy', label: '🟡 Шумно', color: '#eab308' },
        { key: 'busy', label: '🔴 Занято', color: '#ef4444' }
      ];

      statuses.forEach(s => {
        const btn = document.createElement('button');
        btn.textContent = s.label;
        btn.style.cssText = `
          flex: 1;
          padding: 6px 8px;
          border: none;
          border-radius: 4px;
          background: ${room.status === s.key ? s.color : '#e5e7eb'};
          color: ${room.status === s.key ? 'white' : '#374151'};
          cursor: pointer;
          font-size: 11px;
          transition: all 0.2s;
        `;
        btn.onmouseover = () => btn.style.opacity = '0.8';
        btn.onmouseout = () => btn.style.opacity = '1';
        btn.onclick = () => voteForRoom(room.id, s.key);
        buttons.appendChild(btn);
      });

      item.appendChild(buttons);
      list.appendChild(item);
    });
  }

  // Голосование за статус аудитории
  async function voteForRoom(roomId, status) {
    console.log(`[FocusMap] 🗳 Голосование: аудитория ${roomId} -> ${status}`);

    chrome.storage.local.get(['focusmap_user_id', 'focusmap_user_nickname'], async (result) => {
      const userId = result.focusmap_user_id;
      const nickname = result.focusmap_user_nickname || 'Студент';
      
      if (!userId) {
        alert('⚠️ Сначала зарегистрируйтесь или войдите через иконку расширения!');
        return;
      }

      try {
        // Проверяем рейтинг
        const { data: userProfile } = await supabaseClient
          .from('users')
          .select('reputation')
          .eq('id', userId)
          .single();

        const userReputation = userProfile?.reputation || 5.00;
        
        if (userReputation < 3.00) {
          alert(`️ Ваш рейтинг слишком низкий (${userReputation.toFixed(2)}). Голосуйте точнее!`);
          return;
        }

        const voteWeight = userReputation / 5.00;

        // 1. Записываем голос
        const { error: voteError } = await supabaseClient.from('votes').insert({
          room_id: roomId,
          user_id: userId,
          status: status,
          weight: voteWeight,
          created_at: new Date().toISOString()
        });

        if (voteError) throw voteError;

        // ✅ 2. ГЛАВНОЕ: СРАЗУ обновляем статус в таблице rooms!
        await supabaseClient
          .from('rooms')
          .update({ status: status })
          .eq('id', roomId);

        console.log('[FocusMap] ✅ Голос записан И статус обновлён в базе!');

        // 3. Обновляем UI
        const roomIndex = currentRooms.findIndex(r => r.id === roomId);
        if (roomIndex !== -1) {
          currentRooms[roomIndex].status = status;
          renderMarkers();
          updateRoomList();
        }

        // Пересчитываем через 5 минут (но статус уже обновлён)
        setTimeout(() => recalcRoomStatus(roomId), 300_000);
        
      } catch (err) {
        console.error('[FocusMap] ❌ Ошибка:', err);
      }
    });
  }

  async function processVote(roomId, status, userId, nickname) {
    try {
      // Проверяем рейтинг пользователя
      const { data: userProfile, error: profileError } = await supabaseClient
        .from('users')
        .select('reputation')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('[FocusMap] ❌ Ошибка получения профиля:', profileError);
        // Создаём профиль, если его нет
        await supabaseClient.from('users').insert({
          id: userId,
          email: localStorage.getItem('focusmap_user_email') || 'anon@nsu.ru',
          nickname: nickname,
          reputation: 5.00,
          total_votes: 0,
          correct_votes: 0
        });
      }

      const userReputation = userProfile?.reputation || 5.00;
      
      if (userReputation < 3.00) {
        alert(`⚠️ Ваш рейтинг слишком низкий (${userReputation.toFixed(2)}). Голосуйте точнее!`);
        return;
      }

      const voteWeight = userReputation / 5.00;

      // Записываем голос
      const { error: voteError } = await supabaseClient.from('votes').insert({
        room_id: roomId,
        user_id: userId,
        status: status,
        weight: voteWeight,
        created_at: new Date().toISOString()
      });

      if (voteError) {
        console.error('[FocusMap] ❌ Ошибка записи голоса:', voteError);
        alert('❌ Ошибка голосования: ' + voteError.message);
        return;
      }

      console.log('[FocusMap] ✅ Голос записан!');

      // Обновляем UI
      const roomIndex = currentRooms.findIndex(r => r.id === roomId);
      if (roomIndex !== -1) {
        currentRooms[roomIndex].status = status;
        renderMarkers();
        updateRoomList();
      }

      setTimeout(() => recalcRoomStatus(roomId), 300_000);
      
    } catch (err) {
      console.error('[FocusMap]  Ошибка:', err);
    }
  }

  // Пересчет статуса аудитории на основе голосов
  async function recalcRoomStatus(roomId) {
    try {
      // Получаем все голоса за последний час
      const { data: votes, error } = await supabaseClient
        .from('votes')
        .select('status, user_id, weight')
        .eq('room_id', roomId)
        .gte('created_at', new Date(Date.now() - 3600_000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!votes || votes.length === 0) return;

      // Считаем взвешенные голоса
      const weightedCounts = { quiet: 0, noisy: 0, busy: 0 };
      
      votes.forEach(v => {
        const weight = v.weight || 1.0;
        if (weightedCounts[v.status] !== undefined) {
          weightedCounts[v.status] += weight;
        }
      });

      // Находим победителя
      const newStatus = Object.entries(weightedCounts).sort((a, b) => b[1] - a[1])[0][0];
      
      console.log(`[FocusMap] 📊 Голоса для ${roomId}:`, weightedCounts, '→', newStatus);

      // Обновляем статус в базе
      await supabaseClient
        .from('rooms')
        .update({ status: newStatus })
        .eq('id', roomId);

      // 5. Обновляем рейтинги пользователей
      await updateUsersRatings(roomId, votes, newStatus);

    } catch (err) {
      console.error('[FocusMap] ❌ Ошибка пересчёта:', err);
    }
  }

  async function updateUsersRatings(roomId, votes, finalStatus) {
    console.log(`[FocusMap] 🏆 Обновляем рейтинги для аудитории ${roomId}`);
    
    for (const vote of votes) {
      const isCorrect = vote.status === finalStatus;
      
      // Наказание/поощрение в формате такси (от 5.00)
      let reputationChange = 0;
      
      if (isCorrect) {
        reputationChange = 0.02; // +0.02 за правильный голос (медленный рост)
      } else {
        // Штраф зависит от серьёзности ошибки
        const finalStatusSeverity = { quiet: 1, noisy: 2, busy: 3 }[finalStatus] || 1;
        const voteStatusSeverity = { quiet: 1, noisy: 2, busy: 3 }[vote.status] || 1;
        const severityDiff = Math.abs(finalStatusSeverity - voteStatusSeverity);
        
        if (severityDiff === 1) {
          reputationChange = -0.10; // Небольшая ошибка (шумно вместо тихо)
        } else if (severityDiff === 2) {
          reputationChange = -0.25; // Серьёзная ошибка (занято вместо тихо)
        }
      }
      
      // Обновляем рейтинг (не ниже 0.00, не выше 5.00)
      const newReputation = Math.max(0.00, Math.min(5.00, 
        (await supabaseClient
          .from('users')
          .select('reputation')
          .eq('id', vote.user_id)
          .single()).data.reputation + reputationChange
      ));
      
      await supabaseClient
        .from('users')
        .update({ 
          reputation: newReputation,
          total_votes: supabase.raw('total_votes + 1'),
          correct_votes: supabase.raw(`correct_votes + ${isCorrect ? 1 : 0}`)
        })
        .eq('id', vote.user_id);
    }
    
    console.log(`[FocusMap] ✅ Рейтинги обновлены`);
  }

  // Загрузка аудиторий из БД
  async function loadRooms() {
    try {
      const currentFloor = getCurrentFloor();
      const currentBuilding = getCurrentBuilding();
      
      console.log(`[FocusMap] 🏢 Загрузка аудиторий: Корпус ${currentBuilding}, Этаж ${currentFloor}`);
      
      let query = supabaseClient
        .from('rooms')
        .select('*')
        .eq('building', currentBuilding);
      
      // Фильтруем по этажу, если он определен
      if (currentFloor >= 0) {
        query = query.eq('floor', currentFloor);
      }
      
      const { data, error } = await query.order('number');

      if (error) {
        console.error('[FocusMap] ❌ Ошибка загрузки:', error);
        return [];
      }

      console.log(`[FocusMap] 📚 Найдено аудиторий: ${data?.length || 0}`);
      return data || [];
    } catch (err) {
      console.error('[FocusMap] ❌ Ошибка:', err);
      return [];
    }
  }

  // Отрисовка маркеров на карте
  function renderMarkers() {
    const container = prepareMapContainer();
    if (!container) {
      console.warn('[FocusMap] ️ Контейнер карты не найден');
      return;
    }

    document.getElementById('focusmap-overlay')?.remove();

    overlay = document.createElement('div');
    overlay.id = 'focusmap-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
    `;
    container.appendChild(overlay);

    // Рисуем маркеры только для аудиторий с координатами
    currentRooms.forEach(room => {
      if (room.x && room.y) {
        const marker = document.createElement('div');
        marker.className = 'focusmap-marker';
        marker.style.cssText = `
          position: absolute;
          left: ${room.x}%;
          top: ${room.y}%;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: ${getStatusColor(room.status)};
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
          pointer-events: auto;
          transition: transform 0.2s;
        `;
        marker.title = `Ауд. ${room.number}: ${getStatusText(room.status)}`;
        marker.onmouseover = () => marker.style.transform = 'scale(1.3)';
        marker.onmouseout = () => marker.style.transform = 'scale(1)';
        marker.dataset.roomId = room.id;
        marker.onclick = (e) => {
          e.stopPropagation();
          showRoomPopup(room, marker);
        };
        overlay.appendChild(marker);
      }
    });

    console.log(`[FocusMap] 🎉 Отрисовано ${currentRooms.filter(r => r.x && r.y).length} маркеров`);
  }

  // Popup для голосования
  function showRoomPopup(room, anchor) {
    document.getElementById('focusmap-popup')?.remove();

    const popup = document.createElement('div');
    popup.id = 'focusmap-popup';
    popup.style.cssText = `
      position: fixed;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      padding: 16px;
      z-index: 99999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-width: 200px;
    `;

    const rect = anchor.getBoundingClientRect();
    popup.style.top = `${rect.bottom + 8}px`;
    popup.style.left = `${rect.left}px`;

    popup.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 12px; font-size: 16px;">Ауд. ${room.number}</div>
      <div style="margin-bottom: 12px; color: #6b7280; font-size: 14px;">
        Текущий статус: <strong style="color: ${getStatusColor(room.status)}">${getStatusText(room.status)}</strong>
      </div>
      <div style="display: flex; gap: 8px;">
        <button data-status="quiet" style="flex: 1; padding: 8px; border: none; border-radius: 6px; background: #22c55e; color: white; cursor: pointer;">🟢 Тихо</button>
        <button data-status="noisy" style="flex: 1; padding: 8px; border: none; border-radius: 6px; background: #eab308; color: white; cursor: pointer;">🟡 Шумно</button>
        <button data-status="busy" style="flex: 1; padding: 8px; border: none; border-radius: 6px; background: #ef4444; color: white; cursor: pointer;">🔴 Занято</button>
      </div>
    `;

    document.body.appendChild(popup);

    popup.querySelectorAll('button[data-status]').forEach(btn => {
      btn.onclick = async () => {
        await voteForRoom(room.id, btn.dataset.status);
        popup.remove();
      };
    });

    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!popup.contains(e.target) && e.target !== anchor) {
          popup.remove();
          document.removeEventListener('click', handler);
        }
      });
    }, 100);
  }

  function getStatusColor(status) {
    return { quiet: '#22c55e', noisy: '#eab308', busy: '#ef4444', unknown: '#9ca3af' }[status] || '#22c55e';
  }

  function getStatusText(status) {
    return { quiet: 'Тихо', noisy: 'Шумно', busy: 'Занято', unknown: 'Неизвестно' }[status] || 'Неизвестно';
  }

  function getCurrentBuilding() {
    const url = window.location.href;
    if (url.includes('rektorat') || url.includes('2237729')) return 1;
    if (url.includes('Uchebniy-korpus-n1') || url.includes('2237723')) return 2;
    if (url.includes('glavniy-korpus') || url.includes('2237735')) return 3;
    return 1;
  }

  function getCurrentFloor() {
    // 1. Ищем активную кнопку этажа (красная кнопка на сайте НГУ)
    const floorButtons = document.querySelectorAll('button, .btn, [class*="floor"], [class*="этаж"]');
    
    for (const btn of floorButtons) {
      const style = window.getComputedStyle(btn);
      const text = btn.textContent.trim();
      
      // Проверяем, что кнопка активна (красный фон или выделена)
      if (
        (style.backgroundColor.includes('220') || style.backgroundColor.includes('rgb(220') || 
        style.backgroundColor === 'red' || btn.classList.contains('active') ||
        btn.style.backgroundColor === 'red') &&
        text.match(/^\d+\s*(этаж|ЭТАЖ)?$/i)
      ) {
        const match = text.match(/(\d+)/);
        if (match) {
          console.log(`[FocusMap] 🎯 Найден активный этаж: ${match[1]} (кнопка: "${text}")`);
          return parseInt(match[1]);
        }
      }
    }

    // 2. Ищем в заголовке страницы
    const headings = document.querySelectorAll('h1, h2, h3, .floor-title, .page-title');
    for (const h of headings) {
      const match = h.textContent.match(/(\d+)\s*(этаж|ЭТАЖ|floor)/i);
      if (match) {
        console.log(`[FocusMap]  Найден этаж в заголовке: ${match[1]}`);
        return parseInt(match[1]);
      }
    }

    // 3. Ищем текст "4 ЭТАЖ" или похожий на странице
    const allText = document.body.innerHTML;
    const floorMatch = allText.match(/(\d+)\s*ЭТАЖ/i);
    if (floorMatch) {
      console.log(`[FocusMap] 🎯 Найден этаж в HTML: ${floorMatch[1]}`);
      return parseInt(floorMatch[1]);
    }

    // 4. Цоколь
    const titleText = document.title.toLowerCase();
    if (titleText.includes('цоколь') || titleText.includes('цоко')) {
      console.log('[FocusMap] 🎯 Цокольный этаж');
      return 0;
    }

    console.warn('[FocusMap] ⚠️ Не удалось определить этаж, используем 0');
    return 0;
  }

  // Главная функция загрузки и отрисовки
  async function loadAndRender() {
    currentRooms = await loadRooms();
    renderMarkers();
    updateRoomList();
  }

  // 🔥 РЕЖИМ ДОБАВЛЕНИЯ КООРДИНАТ (включается в popup)
  let addMode = false;

  chrome.storage.local.get(['focusmap_add_mode'], (result) => {
    addMode = result.focusmap_add_mode || false;
    if (addMode) {
      console.log('[FocusMap]  Режим добавления аудиторий ВКЛЮЧЕН');
      enableAddMode();
    }
  });

  // ========== РЕЖИМ ДОБАВЛЕНИЯ И РЕДАКТИРОВАНИЯ ==========

function enableAddMode() {
  const mapContainer = document.querySelector('#focusmap-overlay')?.parentElement;
  if (!mapContainer) {
    console.warn('[FocusMap] ⚠️ Контейнер карты не найден для режима добавления');
    return;
  }

  mapContainer.style.cursor = 'crosshair';
  
  // Клик по пустому месту — добавление новой аудитории
  mapContainer.addEventListener('click', async (e) => {
    if (e.target.id === 'focusmap-overlay' || e.target.classList.contains('focusmap-marker')) return;
    
    const rect = mapContainer.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const number = prompt(`📍 Координаты: x=${x.toFixed(1)}%, y=${y.toFixed(1)}%\n\nВведите номер аудитории:`);
    
    if (number) {
      const { error } = await supabaseClient.from('rooms').insert({
        number: number,
        building: getCurrentBuilding(),
        floor: getCurrentFloor(),
        x: x.toFixed(2),
        y: y.toFixed(2),
        status: 'quiet',
        seats: 0,
        sockets: false,
        wifi: false
      });
      
      if (error) {
        alert('❌ Ошибка: ' + error.message);
      } else {
        alert('✅ Аудитория ' + number + ' добавлена!');
        loadAndRender();
      }
    }
  });

  // Клик по маркеру — перемещение или удаление
  document.querySelectorAll('.focusmap-marker').forEach(marker => {
    marker.style.cursor = 'move';
    marker.addEventListener('dblclick', async (e) => {
      e.stopPropagation();
      const roomId = marker.dataset.roomId;
      const action = prompt('Выберите действие:\n1 - Переместить маркер\n2 - Удалить аудиторию\n\nВведите 1 или 2:');
      
      if (action === '1') {
        // Режим перемещения
        marker.style.cursor = 'crosshair';
        const moveHandler = async (moveEvent) => {
          const rect = mapContainer.getBoundingClientRect();
          const newX = ((moveEvent.clientX - rect.left) / rect.width) * 100;
          const newY = ((moveEvent.clientY - rect.top) / rect.height) * 100;
          
          marker.style.left = `${newX}%`;
          marker.style.top = `${newY}%`;
          
          await supabaseClient
            .from('rooms')
            .update({ x: newX.toFixed(2), y: newY.toFixed(2) })
            .eq('id', roomId);
        };
        
        mapContainer.addEventListener('mousemove', moveHandler);
        mapContainer.addEventListener('click', () => {
          mapContainer.removeEventListener('mousemove', moveHandler);
          alert('✅ Маркер перемещён!');
          loadAndRender();
        }, { once: true });
      } else if (action === '2') {
        if (confirm('Удалить эту аудиторию?')) {
          await supabaseClient.from('rooms').delete().eq('id', roomId);
          alert('✅ Аудитория удалена!');
          loadAndRender();
        }
      }
    });
  });

  console.log('[FocusMap]  Режим добавления ВКЛЮЧЕН. Двойной клик по маркеру — переместить/удалить');
}

  // Запуск
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndRender);
  } else {
    loadAndRender();
  }

  setInterval(loadAndRender, CONFIG.refreshIntervalMs);

  console.log('[FocusMap] ✅ Расширение загружено и работает!');

  // Обработчик сообщений от popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_ADD_MODE') {
      addMode = message.enabled;
      if (addMode) {
        enableAddMode();
      } else {
        location.reload(); // Перезагружаем страницу чтобы выключить режим
      }
    }
    sendResponse({ status: 'ok' });
    return true;
  });

})();