let receivedChunks = [];
let totalSize = 0;


function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}


chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'upload') {
    port.onMessage.addListener((message) => {
      if (message.action === 'uploadChunk') {
        const chunk = base64ToArrayBuffer(message.chunk);
        receivedChunks.push(chunk);
        totalSize += chunk.byteLength;
        console.log('Received chunk:', chunk.byteLength, chunk);
      } else if (message.action === 'uploadComplete') {
        const blob = new Blob(receivedChunks, { type: 'video/webm' });
        console.log('Recording stopped:', blob, 'Total size:', totalSize);
        uploadToGoogleDrive(blob).then((fileId) => {
          makeFilePublic(fileId).then((shareableLink) => {
            port.postMessage({ success: true, link: shareableLink });
          }).catch((error) => {
            port.postMessage({ success: false, error: error.message });
          });
        }).catch((error) => {
          port.postMessage({ success: false, error: error.message });
        });

        // Reset for next upload
        receivedChunks = [];
        totalSize = 0;
      }
    });
  }
});


async function getAccessToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}

async function uploadToGoogleDrive(blob) {
  const accessToken = await getAccessToken();
  const metadata = {
    name: 'screen-recording.webm',
    mimeType: 'video/webm'
  };
  console.log('Uploading file to Google Drive:', metadata, blob);
  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', blob);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
    body: formData
  });

  if (!response.ok) {
    throw new Error('Failed to upload file to Google Drive');
  }

  const fileData = await response.json();
  return fileData.id;
}


async function makeFilePublic(fileId) {
  const accessToken = await getAccessToken();
  const permission = {
    role: 'reader',
    type: 'anyone'
  };
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: new Headers({
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify(permission)
  });

  if (!response.ok) {
    throw new Error('Failed to make file public');
  }

  return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
}

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