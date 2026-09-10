const API_URL =
   "https://1-2-aplicaciones-web-ia-delta.vercel.app/api/chat";

const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const sendButton = document.getElementById("sendButton");
const charCounter = document.getElementById("charCounter");
const MAX_CHARS = input.maxLength;
const newChatButton = document.getElementById("newChatButton");

const MAX_HISTORY = 10;
let history = [];

const LABELS = {
   user: "Tú",
   assistant: "IA",
   loading: "IA",
   error: "Aviso"
};

const GREETING = messages
   .querySelector(".message-content")
   .textContent
   .trim();

function addMessage(text, type) {
   const container = document.createElement("div");
   container.classList.add("message", type);

   const label = document.createElement("div");
   label.classList.add("message-label");
   label.textContent = LABELS[type];

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

function getErrorMessage(status, serverMessage) {
   switch (status) {
       case 400:
           return "Error 400: la solicitud no es válida. "
               + (serverMessage || "Revisa tu mensaje.");

       case 403:
           return "Error 403: este sitio no está autorizado "
               + "para usar el asistente.";

       case 413:
           return "Error 413: el mensaje o la conversación es demasiado "
               + "grande. Escribe un mensaje más corto o inicia "
               + "una nueva conversación.";

       case 500:
           return "Error 500: el servidor no pudo obtener la respuesta "
               + "de la IA. Intenta de nuevo en unos momentos.";

       default:
           return "Error " + status + ": ocurrió un problema inesperado.";
   }
}

function resetConversation() {
   history = [];

   messages.replaceChildren();
   addMessage(GREETING, "assistant");

   input.value = "";
   updateCounter();
   input.focus();
}

newChatButton.addEventListener("click", resetConversation);

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
   newChatButton.disabled = true;

   const loading = addMessage("Pensando...", "loading");

   try {
       const response = await fetch(API_URL, {
           method: "POST",
           headers: {
               "Content-Type": "application/json"
           },
           body: JSON.stringify({
               message: message,
               history: history
           })
       });

       let data = {};

       try {
           data = await response.json();
       }
       catch (parseError) {
           data = {};
       }

       loading.remove();

       if (!response.ok) {
           console.error(
               "Respuesta de error del servidor:",
               response.status,
               data.error
           );

           addMessage(
               getErrorMessage(response.status, data.error),
               "error"
           );

           return;
       }

       addMessage(data.reply, "assistant");

       history.push(
           { role: "user", content: message },
           { role: "assistant", content: data.reply }
       );

       history = history.slice(-MAX_HISTORY);
   }
   catch (error) {
       loading.remove();

       console.error("Error de conexión:", error);

       addMessage(
           "Error de conexión: no fue posible comunicarse con el "
               + "servidor. Revisa tu conexión a Internet e intenta "
               + "de nuevo.",
           "error"
       );
   }
   finally {
       input.disabled = false;
       sendButton.disabled = false;
       newChatButton.disabled = false;
       input.focus();
   }
});