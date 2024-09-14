const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const downloadLink = document.getElementById('downloadLink');

chrome.storage.local.get('isRecording', (data) => {
  if (data.isRecording) {
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } else {
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
});

startBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'startRecording' }, (response) => {
    if (response && response.error) {
      alert(response.error);
    } else {
      startBtn.disabled = true;
      stopBtn.disabled = false;
      chrome.storage.local.set({ isRecording: true });
    }
  });
});

stopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stopRecording' }, (response) => {
    if (response && response.error) {
      alert(response.error);
    } else {
      startBtn.disabled = false;
      stopBtn.disabled = true;
      chrome.storage.local.set({ isRecording: false });

      chrome.storage.local.get('recordingUrl', (data) => {
        if (data.recordingUrl) {
          downloadLink.href = data.recordingUrl;
          downloadLink.download = 'screen-recording.webm';
          downloadLink.style.display = 'block';
          downloadLink.textContent = 'Download Recording';
        }
      });
    }
  });
});