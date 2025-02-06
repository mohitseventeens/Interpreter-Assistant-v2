/*
  openai_realtime.js - Realtime WebSocket connection to OpenAI’s Realtime API.

  This script demonstrates how to:
  - Fetch an API key from a backend endpoint.
  - Connect to a WebSocket using that key.
  - Send a conversation and response event.
  - Listen for and display the final response.

  SECURITY NOTICE:
  Do not expose secret keys in client‑side code in production.
*/

// Global variables
let ws = null;
let OPENAI_API_KEY = null; // Will be fetched from the server
const MODEL_ID = "gpt-4o-mini-realtime-preview-2024-12-17";

// DOM elements for output, status and controls
const outputEl = document.getElementById("output");
const statusEl = document.getElementById("status");
const connectBtn = document.getElementById("connectBtn");
const disconnectBtn = document.getElementById("disconnectBtn");

/**
 * Updates the status element and logs the status.
 * @param {string} text - The status text to display.
 */
function updateStatus(text) {
  statusEl.textContent = "Status: " + text;
  console.log(text);
}

/**
 * Initializes the WebSocket connection.
 */
function initWebSocket() {
  if (!OPENAI_API_KEY) {
    updateStatus("No OpenAI API key available. Cannot connect.");
    return;
  }
  
  // Build the WebSocket URL with the model query parameter.
  const wsUrl = `wss://api.openai.com/v1/realtime?model=${MODEL_ID}`;

  // Define subprotocols.
  const protocols = [
    "realtime",
    "openai-insecure-api-key." + OPENAI_API_KEY.trim(), // Trim any extra whitespace.
    "openai-beta.realtime-v1"
  ];

  // Create the WebSocket connection.
  ws = new WebSocket(wsUrl, protocols);

  // Update UI controls.
  updateStatus("Connecting...");
  connectBtn.disabled = true;
  disconnectBtn.disabled = false;

  ws.addEventListener("open", () => {
    updateStatus("Connected to OpenAI Realtime API.");
    console.log("WebSocket connection opened.");

    // Define user_prompt for testing. TODO later: Find way to add system_prompt. 
    const user_prompt = "System: You are helpful Assistant, respond in Pirate speaks. User: What is the capital of France?";

    // Create a conversation event with a simple user message.
    const conversationEvent = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: user_prompt
          }
        ]
      }
    };

    ws.send(JSON.stringify(conversationEvent));
    console.log("Sent conversation.item.create event.");

    // Instruct the server to generate a response (text only).
    const responseEvent = {
      type: "response.create",
      response: {
        modalities: ["text"]  // You can add "audio" here if needed.
      }
    };

    ws.send(JSON.stringify(responseEvent));
    console.log("Sent response.create event.");
  });

  ws.addEventListener("message", (event) => {
    try {
      const serverEvent = JSON.parse(event.data);
      console.log("Received event:", serverEvent);

      // Look for the final response event.
      if (serverEvent.type === "response.done") {
        // Extract the text from the response.
        const outputItem = serverEvent.response.output[0];
        const extractedText = (outputItem.content && outputItem.content.length > 0)
          ? outputItem.content[0].text
          : "No response text found.";
        console.log("ChatGPT Response:", extractedText);
        outputEl.textContent = extractedText;
      }
      // You can add additional handling for incremental updates here.
    } catch (error) {
      console.error("Error parsing server message:", error);
    }
  });

  ws.addEventListener("error", (error) => {
    console.error("WebSocket error observed:", error);
    updateStatus("Error in WebSocket connection.");
  });

  ws.addEventListener("close", () => {
    updateStatus("WebSocket connection closed.");
    console.log("WebSocket connection closed.");
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
  });
}

/**
 * Closes the current WebSocket connection.
 */
function closeWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
    updateStatus("Disconnecting...");
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
  }
}

/**
 * Fetches the OpenAI API key from the backend.
 */
function fetchApiKey() {
  return fetch('/get-openai-key')
    .then(response => {
      if (!response.ok) {
        throw new Error("Network response was not ok.");
      }
      return response.json();
    })
    .then(data => {
      if (!data.openai_key) {
        throw new Error("OpenAI API key not found in response.");
      }
      OPENAI_API_KEY = data.openai_key;
      console.log("OpenAI API key fetched:", OPENAI_API_KEY);
    })
    .catch(error => {
      console.error("Error fetching API key:", error);
      updateStatus("Error fetching API key.");
    });
}

// Event listeners for the buttons.
connectBtn.addEventListener("click", () => {
  // Only fetch the key if it has not been fetched already.
  if (!OPENAI_API_KEY) {
    fetchApiKey().then(() => {
      if (OPENAI_API_KEY) {
        initWebSocket();
      }
    });
  } else {
    initWebSocket();
  }
});

disconnectBtn.addEventListener("click", () => {
  closeWebSocket();
});

// Optionally, you could auto-connect on page load:
// fetchApiKey().then(() => initWebSocket());
