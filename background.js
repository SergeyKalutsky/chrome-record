chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startRecording' || message.action === 'stopRecording') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      const tabId = tab.id;
      const url = tab.url;

      // Check if the URL is a special page
      if (url.startsWith('chrome://') || url.startsWith('edge://')) {
        console.error('Cannot inject content script into special pages.');
        sendResponse({ error: 'Cannot inject content script into special pages.' });
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
              console.error(chrome.runtime.lastError.message);
              sendResponse({ error: chrome.runtime.lastError.message });
            } else {
              sendResponse(response);
            }
          });
        }
      });
    });
    return true; // Keep the message channel open for sendResponse
  }
});