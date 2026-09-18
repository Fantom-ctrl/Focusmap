chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    focusmap_enabled: true,
    focusmap_building: '1'
  });
});

// Универсальный обработчик сообщений, чтобы избежать ошибок "message channel closed"
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Отвечаем немедленно, чтобы канал не закрывался
  sendResponse({ status: 'ok', received: message.type });
  return true; 
});
