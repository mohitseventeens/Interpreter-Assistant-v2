const DEEPGRAM_API_KEY = "API_KEY"; // Replace with your Deepgram API key
const DEEPGRAM_URL = "wss://api.deepgram.com/v1/listen";
let socket, mediaRecorder, stream;

const statusEl = document.querySelector("#status");
const transcriptEl = document.querySelector("#transcript");
const startBtn = document.querySelector("#start");
const stopBtn = document.querySelector("#stop");

// Start recording and send audio to Deepgram
async function startRecording() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        if (!MediaRecorder.isTypeSupported("audio/webm")) {
            alert("Browser does not support audio/webm");
            return;
        }

        mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        socket = new WebSocket(DEEPGRAM_URL, ["token", DEEPGRAM_API_KEY]);

        socket.onopen = () => {
            statusEl.textContent = "Connected to Deepgram";
            console.log("WebSocket Opened");

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                    socket.send(event.data);
                }
            };

            mediaRecorder.start(500);
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
        };

        socket.onerror = (error) => {
            console.error("WebSocket Error", error);
        };

    } catch (error) {
        console.error("Error accessing microphone", error);
    }
}

// Stop recording and close WebSocket
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop()); // Stop microphone access
    }
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
    statusEl.textContent = "Stopped";
}

// Attach event listeners
startBtn.addEventListener("click", startRecording);
stopBtn.addEventListener("click", stopRecording);
