let mediaRecorder;
let recordedChunks = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startRecording') {
        startRecording();
        sendResponse({});
    } else if (message.action === 'stopRecording') {
        stopRecording();
        sendResponse({});
    }
});

async function startRecording() {
    try {
        // Capture screen stream
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { mediaSource: 'screen' },
            audio: true // Capture system audio
        });

        // Capture microphone audio stream
        const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        // Combine screen and microphone audio streams
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();

        const screenAudioSource = audioContext.createMediaStreamSource(screenStream);
        const micAudioSource = audioContext.createMediaStreamSource(audioStream);

        screenAudioSource.connect(destination);
        micAudioSource.connect(destination);

        const combinedStream = new MediaStream([
            ...screenStream.getVideoTracks(),
            ...destination.stream.getAudioTracks()
        ]);

        mediaRecorder = new MediaRecorder(combinedStream);
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            chrome.runtime.sendMessage({ action: 'uploadToDrive', blob: blob }, (response) => {
                if (response.success) {
                    console.log('File uploaded successfully');
                } else {
                    console.error('Failed to upload file:', response.error);
                }
            });

            // Stop all tracks to release resources
            screenStream.getTracks().forEach(track => track.stop());
            audioStream.getTracks().forEach(track => track.stop());
            // const blob = new Blob(recordedChunks, { type: 'video/webm' });
            // const url = URL.createObjectURL(blob);

            // // Create a download link and click it programmatically
            // document.getElementById('recordingLink')?.remove();
            // const a = document.createElement('a');
            // a.setAttribute('id', 'recordingLink');
            // a.style.display = 'none';
            // a.href = url;
            // a.download = 'screen-recording.webm';
            // document.body.appendChild(a);
            // a.click();
            // window.URL.revokeObjectURL(url);

            // // Stop all tracks to release resources
            // screenStream.getTracks().forEach(track => track.stop());
            // audioStream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
    } catch (err) {
        console.error("Error: " + err);
    }
}

function stopRecording() {
    if (mediaRecorder) {
        mediaRecorder.stop();
    }
}

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

async function uploadToGoogleDrive(blob, accessToken) {
    const metadata = {
        name: 'screen-recording.webm',
        mimeType: 'video/webm'
    };

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
}