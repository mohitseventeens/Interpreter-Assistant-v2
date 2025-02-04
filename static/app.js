// Fetch Deepgram API key from server
let DEEPGRAM_API_KEY;

fetch('/get-deepgram-key')
    .then(response => response.json())
    .then(data => {
        DEEPGRAM_API_KEY = data.key;
    })
    .catch(error => {
        console.error('Error fetching API key:', error);
        statusEl.textContent = 'Error: Unable to get API key';
    });

// Define a function to create the Deepgram URL with parameters
function createDeepgramUrl(params = {}) {
    const baseUrl = "wss://api.deepgram.com/v1/listen";
    const queryParams = new URLSearchParams(params).toString();
    return `${baseUrl}?${queryParams}`;
}

let socket, mediaRecorder, stream;

const statusEl = document.querySelector("#status");
const transcriptEl = document.querySelector("#transcript");
const timerEl = document.querySelector("#timer");
const startBtn = document.querySelector("#start");
const stopBtn = document.querySelector("#stop");
const browserAudioBtn = document.querySelector("#browser-audio");

let startTime;
let timerInterval;

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        timerEl.textContent = formatTime(elapsedTime);
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    const elapsedTime = Date.now() - startTime;
    timerEl.textContent = formatTime(elapsedTime);
}

// Helper: initialize the Deepgram WebSocket connection and media recorder event handling
function initDeepgramConnectionAndRecording(currentStream) {
    // Define your Deepgram parameters here
    const deepgramParams = {
        model: "nova-2",
        language: "fr",
        smart_format: "true",
        interim_results: "true"
    };

    const DEEPGRAM_URL = createDeepgramUrl(deepgramParams);

    socket = new WebSocket(DEEPGRAM_URL, ["token", DEEPGRAM_API_KEY]);

    socket.onopen = () => {
        statusEl.textContent = "Connected to Deepgram";
        console.log("WebSocket Opened");
        startTimer();

        // Set up MediaRecorder to send audio data
        mediaRecorder = new MediaRecorder(currentStream, { mimeType: "audio/webm" });
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                socket.send(event.data);
            }
        };

        // Start sending data every 400ms (adjust as needed)
        mediaRecorder.start(400);
    };

    socket.onmessage = (message) => {
        const received = JSON.parse(message.data);
        const transcript = received.channel?.alternatives[0]?.transcript;
        if (transcript && received.is_final) {
            console.log(transcript);
            transcriptEl.textContent += transcript + " ";
        }
    };

    socket.onclose = () => {
        console.log("WebSocket Closed");
        statusEl.textContent = "Disconnected";
        stopTimer();
    };

    socket.onerror = (error) => {
        console.error("WebSocket Error", error);
    };
}

// Start recording from the microphone
async function startRecording() {
    try {
        // Capture microphone audio
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!MediaRecorder.isTypeSupported("audio/webm")) {
            alert("Browser does not support audio/webm");
            return;
        }
        initDeepgramConnectionAndRecording(stream);
    } catch (error) {
        console.error("Error accessing microphone", error);
    }
}

// Start recording browser (tab) audio
async function startBrowserAudioRecording() {
    try {
        // Request both audio and video from the browser.
        // This will prompt the user to select a screen or tab to share.
        stream = await navigator.mediaDevices.getDisplayMedia({ 
            audio: true, 
            video: true 
        });
        // Stop the video track immediately if you only need the audio.
        stream.getVideoTracks().forEach(track => track.stop());
        
        if (!MediaRecorder.isTypeSupported("audio/webm")) {
            alert("Browser does not support audio/webm");
            return;
        }
        initDeepgramConnectionAndRecording(stream);
    } catch (error) {
        console.error("Error accessing browser audio", error);
    }
}

// Stop recording and close WebSocket
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
        // Stop all tracks (microphone or display capture)
        stream.getTracks().forEach(track => track.stop());
    }
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
    statusEl.textContent = "Stopped";
    stopTimer();
}

// Attach event listeners
startBtn.addEventListener("click", startRecording);
browserAudioBtn.addEventListener("click", startBrowserAudioRecording);
stopBtn.addEventListener("click", stopRecording);