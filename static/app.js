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
const transcriptEnEl = document.querySelector("#transcript-en");
const transcriptFrEl = document.querySelector("#transcript-fr");
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
    // Create two WebSocket connections for dual transcription
    const deepgramParamsEn = {
        model: "nova-2",
        language: "en",
        smart_format: "true",
        interim_results: "true"
    };

    const deepgramParamsFr = {
        model: "nova-2",
        language: "fr",
        smart_format: "true",
        interim_results: "true"
    };

    const DEEPGRAM_URL_EN = createDeepgramUrl(deepgramParamsEn);
    const DEEPGRAM_URL_FR = createDeepgramUrl(deepgramParamsFr);

    // Create separate WebSocket connections for English and French
    const socketEn = new WebSocket(DEEPGRAM_URL_EN, ["token", DEEPGRAM_API_KEY]);
    const socketFr = new WebSocket(DEEPGRAM_URL_FR, ["token", DEEPGRAM_API_KEY]);

    // Handle WebSocket connections
    let connectionsEstablished = 0;
    
    const handleConnectionOpen = () => {
        connectionsEstablished++;
        if (connectionsEstablished === 2) {
            statusEl.textContent = "Connected to Deepgram";
            console.log("WebSocket Connections Opened");
            startTimer();

            // Set up MediaRecorder to send audio data to both connections
            mediaRecorder = new MediaRecorder(currentStream, { mimeType: "audio/webm" });
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    if (socketEn.readyState === WebSocket.OPEN) {
                        socketEn.send(event.data);
                    }
                    if (socketFr.readyState === WebSocket.OPEN) {
                        socketFr.send(event.data);
                    }
                }
            };

            // Start sending data every 400ms (adjust as needed)
            mediaRecorder.start(400);
        }
    };

    socketEn.onopen = handleConnectionOpen;
    socketFr.onopen = handleConnectionOpen;

    // Handle messages from both WebSocket connections
    socketEn.onmessage = (message) => {
        const received = JSON.parse(message.data);
        const transcript = received.channel?.alternatives[0]?.transcript;
        if (transcript && received.is_final) {
            console.log("English:", transcript);
            transcriptEnEl.textContent += transcript + " ";
        }
    };

    socketFr.onmessage = (message) => {
        const received = JSON.parse(message.data);
        const transcript = received.channel?.alternatives[0]?.transcript;
        if (transcript && received.is_final) {
            console.log("French:", transcript);
            transcriptFrEl.textContent += transcript + " ";
        }
    };

    socketEn.onclose = () => {
        console.log("English WebSocket Closed");
        stopTimer();
    };

    socketFr.onclose = () => {
        console.log("French WebSocket Closed");
        statusEl.textContent = "Disconnected";
        stopTimer();
    };

    socketEn.onerror = (error) => {
        console.error("English WebSocket Error", error);
    };

    socketFr.onerror = (error) => {
        console.error("French WebSocket Error", error);
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

// Stop recording and close all connections
function stopRecording() {
    // Immediately update the UI to show stopping status.
    statusEl.textContent = "Stopping... Please wait";
    stopTimer();

    // Stop the MediaRecorder if it's active.
    if (mediaRecorder?.state !== "inactive") {
        mediaRecorder.stop();
    }

    // Stop all media tracks.
    if (stream) {
        stream.getTracks().forEach(track => {
            try {
                track.stop();
            } catch (error) {
                console.error("Error stopping media track:", error);
            }
        });
    }

    // Close both WebSocket connections.
    [socketEn, socketFr].forEach((socket, index) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            try {
                socket.close();
            } catch (error) {
                console.error(`Error closing ${index === 0 ? "English" : "French"} WebSocket:`, error);
            }
        }
    });

    // Update UI and stop the timer.
    statusEl.textContent = "Stopped";
}


// Attach event listeners
startBtn.addEventListener("click", startRecording);
browserAudioBtn.addEventListener("click", startBrowserAudioRecording);
stopBtn.addEventListener("click", stopRecording);