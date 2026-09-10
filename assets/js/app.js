const API_URL =
   "https://1-2-aplicaciones-web-ia-delta.vercel.app/api/chat";

const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const sendButton = document.getElementById("sendButton");
const charCounter = document.getElementById("charCounter");
const MAX_CHARS = input.maxLength;

function addMessage(text, type) {
   const container = document.createElement("div");
   container.classList.add("message", type);

   const label = document.createElement("div");
   label.classList.add("message-label");
   label.textContent = type === "user" ? "Tú" : "IA";

   const content = document.createElement("div");
   content.classList.add("message-content");
   content.textContent = text;

   container.appendChild(label);
   container.appendChild(content);
   messages.appendChild(container);

   messages.scrollTop = messages.scrollHeight;

   return container;
}

function updateCounter() {
   const length = input.value.length;

   charCounter.textContent = length + " / " + MAX_CHARS;
   charCounter.classList.toggle("near-limit", length >= 900);
}

input.addEventListener("input", updateCounter);

form.addEventListener("submit", async (event) => {
   event.preventDefault();

   const message = input.value.trim();

   if (!message) {
       return;
   }

   addMessage(message, "user");

   input.value = "";
   updateCounter();
   input.disabled = true;
   sendButton.disabled = true;

   const loading = addMessage("Pensando...", "loading");

   try {
       const response = await fetch(API_URL, {
           method: "POST",
           headers: {
               "Content-Type": "application/json"
           },
           body: JSON.stringify({
               message: message
           })
       });

       const data = await response.json();

       loading.remove();

       if (!response.ok) {
           throw new Error(
               data.error || "Error del servidor"
           );
       }

       addMessage(data.reply, "assistant");
   }
   catch (error) {
       loading.remove();

       addMessage(
           "Error: " + error.message,
           "assistant"
       );
   }
   finally {
       input.disabled = false;
       sendButton.disabled = false;
       input.focus();
   }
});