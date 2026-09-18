// ============================================
// popup.js — регистрация и вход
// ============================================

// ⚠️ ВСТАВЬТЕ СВОИ ДАННЫЕ ИЗ SUPABASE!
const SUPABASE_URL = 'https://rfksyolvmrlnsdfapely.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CLuAjYS9sOAECkqTSsqlXw_Gps5vIcN'; 

console.log('[Popup] 🚀 Скрипт запущен');
console.log('[Popup] URL:', SUPABASE_URL);
console.log('[Popup] Key начинается с:', SUPABASE_KEY.substring(0, 20) + '...');

// Проверка, что библиотека загружена
if (typeof window.supabase === 'undefined') {
  console.error('[Popup] ❌ ОШИБКА: Supabase библиотека НЕ загружена!');
  alert('Ошибка: библиотека Supabase не загружена. Проверьте, что файл lib/supabase.min.js существует.');
} else {
  console.log('[Popup] ✅ Supabase библиотека загружена');
}

// Создаём клиент
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
console.log('[Popup] ✅ Клиент Supabase создан');

// Элементы DOM
const authSection = document.getElementById('auth-section');
const mainSection = document.getElementById('main-section');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const nicknameInput = document.getElementById('nickname');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const authError = document.getElementById('auth-error');
const userNickname = document.getElementById('user-nickname');
const userReputation = document.getElementById('user-reputation');
const statusEl = document.getElementById('status');

// Проверяем авторизацию при загрузке
  async function checkAuth() {
    console.log('[Popup] 🔍 Проверяем авторизацию...');
    
    // 1. Сначала проверяем chrome.storage (на случай если Supabase Auth "забыл")
    chrome.storage.local.get(['focusmap_user_id', 'focusmap_user_nickname'], async (result) => {
      const storedUserId = result.focusmap_user_id;
      const storedNickname = result.focusmap_user_nickname;
      
      if (storedUserId) {
        // Пользователь есть в chrome.storage — показываем его
        console.log('[Popup] ✅ Найден пользователь в chrome.storage:', storedUserId);
        
        // Загружаем профиль из базы
        const { data: profile } = await supabase
          .from('users')
          .select('nickname, reputation, total_votes, correct_votes')
          .eq('id', storedUserId)
          .single();
        
        if (profile) {
          authSection.style.display = 'none';
          mainSection.style.display = 'block';
          userNickname.textContent = profile.nickname || storedNickname || 'Студент';
          userReputation.textContent = (profile.reputation || 5.00).toFixed(2);
          
          const total = profile.total_votes || 0;
          const correct = profile.correct_votes || 0;
          const accuracy = total > 0 ? Math.round((correct / total) * 100) : 100;
          
          document.getElementById('total-votes').textContent = total;
          document.getElementById('accuracy').textContent = accuracy + '%';
          statusEl.textContent = '✅ Авторизован';
          return;
        }
      }
      
      // 2. Если в chrome.storage нет — проверяем Supabase Auth
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (user) {
          console.log('[Popup] ✅ Пользователь авторизован через Supabase:', user.email);
          
          // Сохраняем в chrome.storage для content.js
          chrome.storage.local.set({
            focusmap_user_id: user.id,
            focusmap_user_nickname: user.user_metadata?.nickname || 'Студент'
          });
          
          authSection.style.display = 'none';
          mainSection.style.display = 'block';
          
          const { data: profile } = await supabase
            .from('users')
            .select('nickname, reputation, total_votes, correct_votes')
            .eq('id', user.id)
            .single();
          
          if (profile) {
            userNickname.textContent = profile.nickname || 'Студент';
            userReputation.textContent = (profile.reputation || 5.00).toFixed(2);
            
            const total = profile.total_votes || 0;
            const correct = profile.correct_votes || 0;
            const accuracy = total > 0 ? Math.round((correct / total) * 100) : 100;
            
            document.getElementById('total-votes').textContent = total;
            document.getElementById('accuracy').textContent = accuracy + '%';
          }
          
          statusEl.textContent = '✅ Авторизован';
          return;
        }
      } catch (err) {
        console.warn('[Popup] ⚠️ Ошибка getUser:', err.message);
      }
      
      // 3. Если нигде не нашли — показываем форму входа
      console.log('[Popup] ️ Пользователь не авторизован');
      authSection.style.display = 'block';
      mainSection.style.display = 'none';
      statusEl.textContent = ' Требуется вход';
    });
  }

// РЕГИСТРАЦИЯ
// РЕГИСТРАЦИЯ (исправленная версия — без кириллицы в metadata)
registerBtn.addEventListener('click', async () => {
  console.log('[Popup]  Нажата кнопка "Зарегистрироваться"');
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const nickname = nicknameInput.value.trim();
  
  console.log('[Popup] Email:', email);
  console.log('[Popup] Никнейм:', nickname);
  
  // Валидация
  if (!email || !password || !nickname) {
    authError.textContent = '❌ Заполните все поля';
    authError.style.color = '#ef4444';
    return;
  }
  
  if (password.length < 6) {
    authError.textContent = '❌ Пароль должен быть минимум 6 символов';
    authError.style.color = '#ef4444';
    return;
  }
  
  if (!email.includes('@')) {
    authError.textContent = '❌ Неверный формат email';
    authError.style.color = '#ef4444';
    return;
  }
  
  authError.textContent = '⏳ Регистрация...';
  authError.style.color = '#2563eb';
  registerBtn.disabled = true;
  registerBtn.textContent = 'Регистрация...';
  
  try {
    // 1. Создаём пользователя БЕЗ metadata (чтобы избежать ошибки кодировки)
    console.log('[Popup] 🔑 Создаём пользователя в Auth...');
    
    const { data: authData, error: authError2 } = await supabase.auth.signUp({
      email: email,
      password: password
      // ⚠️ НЕ передаём options.data с кириллицей!
    });
    
    if (authError2) {
      console.error('[Popup] ❌ Ошибка signUp:', authError2);
      authError.textContent = '❌ ' + authError2.message;
      authError.style.color = '#ef4444';
      registerBtn.disabled = false;
      registerBtn.textContent = 'Зарегистрироваться';
      return;
    }
    
    console.log('[Popup] ✅ Пользователь создан в Auth:', authData.user?.id);
    
    // 2. Создаём профиль в таблице users отдельным запросом
    if (authData.user) {
      console.log('[Popup] 📝 Создаём профиль в таблице users...');
      
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: email,
          nickname: nickname, // ← кириллица теперь в теле запроса, а не в заголовках
          reputation: 5.00,
          total_votes: 0,
          correct_votes: 0
        });
      
      if (profileError) {
        console.error('[Popup] ❌ Ошибка создания профиля:', profileError);
        authError.textContent = '⚠️ Аккаунт создан, но профиль не сохранён: ' + profileError.message;
        authError.style.color = '#f97316';
      } else {
        console.log('[Popup] ✅ Профиль создан!');
        authError.textContent = '✅ Регистрация успешна!';
        authError.style.color = '#22c55e';

        chrome.storage.local.set({
          focusmap_user_id: authData.user.id,
          focusmap_user_nickname: nickname
        });
      }
    }
    
    // 3. Переходим в основной интерфейс
    setTimeout(() => {
      checkAuth();
      registerBtn.disabled = false;
      registerBtn.textContent = 'Зарегистрироваться';
    }, 1500);
    
  } catch (err) {
    console.error('[Popup] ❌ Критическая ошибка регистрации:', err);
    authError.textContent = '❌ Ошибка: ' + err.message;
    authError.style.color = '#ef4444';
    registerBtn.disabled = false;
    registerBtn.textContent = 'Зарегистрироваться';
  }
});

// ВХОД
loginBtn.addEventListener('click', async () => {
  console.log('[Popup]  Нажата кнопка "Войти"');
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  if (!email || !password) {
    authError.textContent = '❌ Введите email и пароль';
    authError.style.color = '#ef4444';
    return;
  }
  
  authError.textContent = '⏳ Вход...';
  authError.style.color = '#2563eb';
  loginBtn.disabled = true;
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('[Popup] ❌ Ошибка входа:', error);
      authError.textContent = '❌ ' + error.message;
      authError.style.color = '#ef4444';
      loginBtn.disabled = false;
      loginBtn.textContent = 'Войти';
      return;
    }
    
    console.log('[Popup] ✅ Вход успешен:', data.user?.email);
    authError.textContent = '✅ Вход выполнен!';
    authError.style.color = '#22c55e';

    chrome.storage.local.set({
      focusmap_user_id: data.user.id,
      focusmap_user_nickname: data.user.user_metadata?.nickname || 'Студент'
    });
    
    setTimeout(checkAuth, 1000);
    
  } catch (err) {
    console.error('[Popup] ❌ Критическая ошибка входа:', err);
    authError.textContent = '❌ ' + err.message;
    loginBtn.disabled = false;
  }
});

// ВЫХОД
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    console.log('[Popup] 🚪 Выход из аккаунта');
    await supabase.auth.signOut();
    checkAuth();
  });
}

// ==========================================
// УПРАВЛЕНИЕ РЕЖИМОМ ДОБАВЛЕНИЯ
// ==========================================
const addModeToggle = document.getElementById('add_mode');

if (addModeToggle) {
  // 1. При открытии popup читаем актуальное состояние из хранилища
  chrome.storage.local.get(['focusmap_add_mode'], (result) => {
    addModeToggle.checked = result.focusmap_add_mode || false;
  });

  // 2. При изменении переключателя отправляем команду в content.js
  addModeToggle.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    
    // Сохраняем состояние, чтобы оно не слетало при закрытии popup
    chrome.storage.local.set({ focusmap_add_mode: isEnabled });
    
    // Отправляем сообщение на активную вкладку с картой НГУ
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('nsu.ru')) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'TOGGLE_ADD_MODE',
          enabled: isEnabled
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('⚠️ Не удалось связаться со страницей. Обновите карту.');
          }
        });
      }
    });
  });
}

// ==========================================
// ПЕРЕКЛЮЧАТЕЛЬ "ВКЛЮЧИТЬ НА КАРТЕ"
// ==========================================
const toggleSwitch = document.getElementById('toggle');

if (toggleSwitch) {
  // 1. При открытии popup — читаем сохранённое состояние
  chrome.storage.local.get(['focusmap_enabled'], (result) => {
    // По умолчанию включено (true)
    toggleSwitch.checked = result.focusmap_enabled !== false;
  });

  // 2. При изменении переключателя — сохраняем и отправляем на карту
  toggleSwitch.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    
    // Сохраняем состояние
    chrome.storage.local.set({ focusmap_enabled: isEnabled });
    
    // Отправляем сообщение на активную вкладку
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'TOGGLE_MAP_VISIBILITY',
          enabled: isEnabled
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('⚠️ Страница карты не открыта');
          }
        });
      }
    });
    
    console.log('[Popup] 🗺️ Карта ' + (isEnabled ? 'включена' : 'выключена'));
  });
}

// Запуск
checkAuth();