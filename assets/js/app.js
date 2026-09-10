/* ==========================================================
   Nodo IA | app.js
   Frontend público: aquí NO existe ninguna credencial.
   Solo se conoce la URL pública de la función de Vercel.
   ========================================================== */

const API_URL =
   "https://1-2-aplicaciones-web-ia-delta.vercel.app/api/chat";

/* ---------- Elementos de la página ---------- */

const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const sendButton = document.getElementById("sendButton");
const charCounter = document.getElementById("charCounter");
const newChatButton = document.getElementById("newChatButton");
const chatList = document.getElementById("chatList");
const topology = document.getElementById("topology");
const topologyStatus = document.getElementById("topologyStatus");
const menuButton = document.getElementById("menuButton");
const sidebarOverlay = document.getElementById("sidebarOverlay");

/* ---------- Configuración ---------- */

const MAX_CHARS = input.maxLength;      // Reto 2: se lee del HTML
const MAX_HISTORY = 10;                 // Reto 4: mensajes de contexto
const MAX_SAVED_CHATS = 30;             // Reto 6: chats en el historial
const STORAGE_KEY = "nodoIA.conversaciones";

const GREETING = messages               // Reto 3: saludo inicial
   .querySelector(".message-content")
   .textContent
   .trim();

const SUGGESTIONS = [
   "¿Qué es MQTT y para qué se usa en IoT?",
   "¿Cuál es la diferencia entre TCP y UDP?",
   "¿Cómo conecto un ESP32 a una red Wi-Fi?",
   "¿Qué es una dirección IP privada?"
];

const LABELS = {
   user: "Tú",
   assistant: "IA",
   loading: "IA",
   error: "Aviso"
};

const STATUS_TEXT = {
   idle: "Listo para tus preguntas",
   sending: "Enviando tu pregunta a Vercel...",
   receiving: "Respuesta recibida",
   error: "No se pudo completar la solicitud"
};

/* ---------- Estado de la aplicación ---------- */

let conversations = loadConversations();
let currentId = null;
let currentMessages = [];
let isWaiting = false;
let statusTimer = null;

/* ==========================================================
   Historial de chats (Reto 6)
   Se guarda en localStorage: vive solo en este navegador.
   Por eso aquí se pueden guardar conversaciones, pero jamás
   un secreto como la API Key.
   ========================================================== */

function loadConversations() {
   try {
       const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

       if (!Array.isArray(saved)) {
           return [];
       }

       return saved
           .filter((chat) => chat && typeof chat.id === "string" && Array.isArray(chat.messages))
           .map((chat) => ({
               id: chat.id,
               title: String(chat.title || "Conversación"),
               updatedAt: Number(chat.updatedAt) || Date.now(),
               messages: chat.messages.filter(
                   (item) =>
                       item &&
                       (item.role === "user" || item.role === "assistant") &&
                       typeof item.content === "string"
               )
           }));
   }
   catch (error) {
       console.warn("No se pudo leer el historial:", error);
       return [];
   }
}

function saveConversations() {
   try {
       localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
   }
   catch (error) {
       console.warn("No se pudo guardar el historial:", error);
   }
}

function createId() {
   return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function makeTitle(text) {
   const clean = text.replace(/\s+/g, " ").trim();

   return clean.length > 42 ? clean.slice(0, 42) + "..." : clean;
}

function formatDate(timestamp) {
   const date = new Date(timestamp);
   const time = date.toLocaleTimeString("es-MX", {
       hour: "2-digit",
       minute: "2-digit"
   });

   if (date.toDateString() === new Date().toDateString()) {
       return "Hoy, " + time;
   }

   return date.toLocaleDateString("es-MX", {
       day: "numeric",
       month: "short"
   }) + ", " + time;
}

function saveCurrentConversation() {
   if (currentMessages.length === 0) {
       return;
   }

   let chat = conversations.find((item) => item.id === currentId);

   if (!chat) {
       chat = {
           id: currentId,
           title: makeTitle(currentMessages[0].content),
           updatedAt: Date.now(),
           messages: []
       };

       conversations.unshift(chat);
   }

   chat.messages = currentMessages.slice();
   chat.updatedAt = Date.now();

   conversations.sort((a, b) => b.updatedAt - a.updatedAt);
   conversations = conversations.slice(0, MAX_SAVED_CHATS);

   saveConversations();
   renderChatList();
}

function renderChatList() {
   chatList.replaceChildren();

   if (conversations.length === 0) {
       const empty = document.createElement("li");
       empty.classList.add("chat-empty");
       empty.textContent = "Aún no hay conversaciones. Tus chats aparecerán aquí.";
       chatList.appendChild(empty);
       return;
   }

   conversations.forEach((chat) => {
       const item = document.createElement("li");
       item.classList.add("chat-item");

       if (chat.id === currentId) {
           item.classList.add("active");
       }

       const openButton = document.createElement("button");
       openButton.type = "button";
       openButton.classList.add("chat-open");
       openButton.title = chat.title;
       openButton.disabled = isWaiting;

       const title = document.createElement("span");
       title.classList.add("chat-title");
       title.textContent = chat.title;

       const date = document.createElement("span");
       date.classList.add("chat-date");
       date.textContent = formatDate(chat.updatedAt);

       openButton.append(title, date);
       openButton.addEventListener("click", () => openConversation(chat.id));

       const deleteButton = document.createElement("button");
       deleteButton.type = "button";
       deleteButton.classList.add("chat-delete");
       deleteButton.textContent = "×";
       deleteButton.setAttribute("aria-label", "Eliminar conversación: " + chat.title);
       deleteButton.disabled = isWaiting;
       deleteButton.addEventListener("click", () => deleteConversation(chat.id));

       item.append(openButton, deleteButton);
       chatList.appendChild(item);
   });
}

function openConversation(id) {
   if (isWaiting) {
       return;
   }

   const chat = conversations.find((item) => item.id === id);

   if (!chat) {
       return;
   }

   currentId = chat.id;
   currentMessages = chat.messages.slice();

   messages.replaceChildren();
   addMessage(GREETING, "assistant");

   currentMessages.forEach((item) => {
       addMessage(item.content, item.role, {
           copyable: item.role === "assistant"
       });
   });

   renderChatList();
   closeSidebar();
   input.focus();
}

function deleteConversation(id) {
   if (isWaiting) {
       return;
   }

   if (!confirm("¿Eliminar esta conversación del historial?")) {
       return;
   }

   conversations = conversations.filter((item) => item.id !== id);
   saveConversations();

   if (id === currentId) {
       resetConversation();
   }
   else {
       renderChatList();
   }
}

/* ==========================================================
   Mensajes
   ========================================================== */

function addMessage(text, type, options = {}) {
   const container = document.createElement("div");
   container.classList.add("message", type);

   const label = document.createElement("div");
   label.classList.add("message-label");
   label.textContent = LABELS[type];

   const content = document.createElement("div");
   content.classList.add("message-content");
   content.textContent = text;           // textContent: nunca ejecuta HTML

   container.appendChild(label);
   container.appendChild(content);

   if (options.copyable) {
       container.appendChild(createCopyButton(text));
   }

   messages.appendChild(container);
   messages.scrollTop = messages.scrollHeight;

   return container;
}

function createCopyButton(text) {
   const button = document.createElement("button");
   button.type = "button";
   button.classList.add("copy-button");
   button.textContent = "Copiar respuesta";

   button.addEventListener("click", async () => {
       try {
           await navigator.clipboard.writeText(text);
           button.textContent = "Copiada";
       }
       catch (error) {
           button.textContent = "No se pudo copiar";
       }

       setTimeout(() => {
           button.textContent = "Copiar respuesta";
       }, 1500);
   });

   return button;
}

function renderSuggestions() {
   const box = document.createElement("div");
   box.classList.add("suggestions");

   const title = document.createElement("p");
   title.classList.add("suggestions-title");
   title.textContent = "Prueba con una de estas preguntas:";

   const list = document.createElement("div");
   list.classList.add("suggestion-list");

   SUGGESTIONS.forEach((text) => {
       const button = document.createElement("button");
       button.type = "button";
       button.classList.add("suggestion");
       button.textContent = text;

       button.addEventListener("click", () => {
           input.value = text;
           updateCounter();
           form.requestSubmit();
       });

       list.appendChild(button);
   });

   box.append(title, list);
   messages.appendChild(box);
}

/* ---------- Reto 2: contador de caracteres ---------- */

function updateCounter() {
   const length = input.value.length;

   charCounter.textContent = length + " / " + MAX_CHARS;
   charCounter.classList.toggle("near-limit", length >= 900);
}

function autoResize() {
   input.style.height = "auto";
   input.style.height = Math.min(input.scrollHeight, 160) + "px";
}

input.addEventListener("input", () => {
   updateCounter();
   autoResize();
});

input.addEventListener("keydown", (event) => {
   if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
       event.preventDefault();
       form.requestSubmit();
   }
});

/* ---------- Reto 3: nueva conversación ---------- */

function resetConversation() {
   currentId = createId();
   currentMessages = [];

   messages.replaceChildren();
   addMessage(GREETING, "assistant");
   renderSuggestions();

   input.value = "";
   updateCounter();
   autoResize();
   renderChatList();
   closeSidebar();
   input.focus();
}

newChatButton.addEventListener("click", resetConversation);

/* ---------- Reto 5: mensajes por código de error ---------- */

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

/* ---------- Reto 6: topología animada y estado ---------- */

function setNetworkState(state) {
   clearTimeout(statusTimer);

   topology.dataset.state = state;
   topologyStatus.textContent = STATUS_TEXT[state];

   if (state === "receiving" || state === "error") {
       statusTimer = setTimeout(() => {
           setNetworkState("idle");
       }, state === "error" ? 3500 : 1600);
   }
}

function setWaiting(waiting) {
   isWaiting = waiting;

   input.disabled = waiting;
   sendButton.disabled = waiting;
   newChatButton.disabled = waiting;

   document
       .querySelectorAll(".suggestion, .chat-open, .chat-delete")
       .forEach((button) => {
           button.disabled = waiting;
       });
}

/* ---------- Menú lateral en celulares ---------- */

function openSidebar() {
   document.body.classList.add("sidebar-open");
   menuButton.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
   document.body.classList.remove("sidebar-open");
   menuButton.setAttribute("aria-expanded", "false");
}

menuButton.addEventListener("click", () => {
   if (document.body.classList.contains("sidebar-open")) {
       closeSidebar();
   }
   else {
       openSidebar();
   }
});

sidebarOverlay.addEventListener("click", closeSidebar);

document.addEventListener("keydown", (event) => {
   if (event.key === "Escape") {
       closeSidebar();
   }
});

/* ==========================================================
   Envío de preguntas al backend
   ========================================================== */

form.addEventListener("submit", async (event) => {
   event.preventDefault();

   if (isWaiting) {
       return;
   }

   const message = input.value.trim();

   if (!message) {
       return;
   }

   const suggestions = messages.querySelector(".suggestions");

   if (suggestions) {
       suggestions.remove();
   }

   addMessage(message, "user");

   input.value = "";
   updateCounter();
   autoResize();

   setWaiting(true);
   setNetworkState("sending");

   const loading = addMessage("Pensando...", "loading");

   try {
       const response = await fetch(API_URL, {
           method: "POST",
           headers: {
               "Content-Type": "application/json"
           },
           body: JSON.stringify({
               message: message,
               history: currentMessages.slice(-MAX_HISTORY)
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

           setNetworkState("error");
           return;
       }

       addMessage(data.reply, "assistant", { copyable: true });

       currentMessages.push(
           { role: "user", content: message },
           { role: "assistant", content: data.reply }
       );

       saveCurrentConversation();
       setNetworkState("receiving");
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

       setNetworkState("error");
   }
   finally {
       setWaiting(false);
       input.focus();
   }
});

/* ---------- Inicio ---------- */

resetConversation();