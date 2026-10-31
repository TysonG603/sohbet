const socket = io({ autoConnect: true });

const $ = (id) => document.getElementById(id);
const loginEl = $("login");
const chatEl = $("chat");
const loginForm = $("loginForm");
const nameInput = $("nameInput");
const loginBtn = $("loginBtn");
const loginError = $("loginError");
const messagesEl = $("messages");
const messageForm = $("messageForm");
const messageInput = $("messageInput");
const userListEl = $("userList");
const typingEl = $("typing");
const sidebar = $("sidebar");
const backdrop = $("backdrop");

let myName = null;
let lastSender = null;
const typingUsers = new Set();

// ---------- Yardımcılar ----------
const COLORS = ["#7c5cff", "#22d3ee", "#f472b6", "#fb923c", "#34d399", "#60a5fa", "#facc15", "#a78bfa", "#f87171", "#2dd4bf"];
function colorFor(name) {
  let h = 0;
  for (const c of name.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

function avatar(name) {
  const el = document.createElement("div");
  el.className = "avatar";
  el.textContent = [...name][0];
  el.style.background = colorFor(name);
  return el;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

// Metni güvenli şekilde ekler, bağlantıları tıklanabilir yapar
function renderText(el, text) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  for (const part of parts) {
    if (/^https?:\/\//.test(part)) {
      const a = document.createElement("a");
      a.href = part;
      a.textContent = part;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      el.appendChild(a);
    } else if (part) {
      el.appendChild(document.createTextNode(part));
    }
  }
}

function isNearBottom() {
  return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 120;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showEmptyState() {
  messagesEl.innerHTML = `<div class="empty"><div class="big">👋</div><p>Henüz mesaj yok. İlk mesajı sen yaz!</p></div>`;
}

// ---------- Mesaj çizimi ----------
function addMessage(msg) {
  const empty = messagesEl.querySelector(".empty");
  if (empty) empty.remove();

  const stick = isNearBottom() || msg.user === myName;

  if (msg.type === "system") {
    const el = document.createElement("div");
    el.className = "system";
    el.textContent = `${msg.text} · ${formatTime(msg.time)}`;
    messagesEl.appendChild(el);
    lastSender = null;
  } else {
    const mine = msg.user === myName;
    const grouped = lastSender === msg.user;

    const row = document.createElement("div");
    row.className = `msg${mine ? " mine" : ""}${grouped ? " grouped" : ""}`;
    row.appendChild(avatar(msg.user));

    const body = document.createElement("div");
    body.className = "body";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = mine ? "Sen" : msg.user;
    if (!mine) meta.style.color = colorFor(msg.user);

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    renderText(bubble, msg.text);
    const time = document.createElement("span");
    time.className = "time";
    time.textContent = formatTime(msg.time);
    bubble.appendChild(time);

    body.append(meta, bubble);
    row.appendChild(body);
    messagesEl.appendChild(row);
    lastSender = msg.user;
  }

  if (stick) scrollToBottom();
}

function renderUsers(list) {
  $("userCount").textContent = list.length;
  $("topbarInfo").textContent = `${list.length} kişi çevrimiçi`;
  userListEl.innerHTML = "";
  for (const name of list) {
    const li = document.createElement("li");
    li.appendChild(avatar(name));
    li.appendChild(document.createTextNode(name));
    if (name === myName) {
      const you = document.createElement("span");
      you.className = "you";
      you.textContent = "sen";
      li.appendChild(you);
    }
    userListEl.appendChild(li);
  }
}

function renderTyping() {
  const names = [...typingUsers];
  if (names.length === 0) typingEl.textContent = "";
  else if (names.length === 1) typingEl.textContent = `${names[0]} yazıyor…`;
  else if (names.length === 2) typingEl.textContent = `${names[0]} ve ${names[1]} yazıyor…`;
  else typingEl.textContent = "Birkaç kişi yazıyor…";
}

// ---------- Giriş ----------
function join(name) {
  loginBtn.disabled = true;
  loginError.textContent = "";
  socket.emit("join", name, (res) => {
    loginBtn.disabled = false;
    if (!res.ok) {
      loginError.textContent = res.error;
      loginEl.classList.remove("hidden");
      chatEl.classList.add("hidden");
      return;
    }
    myName = res.name;
    localStorage.setItem("sohbet:name", myName);

    $("meName").textContent = myName;
    const meAv = $("meAvatar");
    meAv.textContent = [...myName][0];
    meAv.style.background = colorFor(myName);

    messagesEl.innerHTML = "";
    lastSender = null;
    if (res.history.length === 0) showEmptyState();
    res.history.forEach(addMessage);
    scrollToBottom();

    loginEl.classList.add("hidden");
    chatEl.classList.remove("hidden");
    messageInput.focus();
  });
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (name.length < 2) {
    loginError.textContent = "Kullanıcı adı en az 2 karakter olmalı.";
    return;
  }
  join(name);
});

try {
  const saved = localStorage.getItem("sohbet:name");
  if (saved) nameInput.value = saved;
} catch {}

$("logoutBtn").addEventListener("click", () => {
  try { localStorage.removeItem("sohbet:name"); } catch {}
  location.reload();
});

// ---------- Mesaj gönderme ----------
let typingTimer = null;
let isTyping = false;

function stopTyping() {
  if (isTyping) socket.emit("typing", false);
  isTyping = false;
  clearTimeout(typingTimer);
}

function autoResize() {
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 140) + "px";
}

messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  socket.emit("message", text);
  messageInput.value = "";
  autoResize();
  stopTyping();
  messageInput.focus();
});

messageInput.addEventListener("keydown", (e) => {
  // Enter gönderir, Shift+Enter yeni satır (mobilde Enter yeni satır)
  const isTouch = matchMedia("(pointer: coarse)").matches;
  if (e.key === "Enter" && !e.shiftKey && !isTouch && !e.isComposing) {
    e.preventDefault();
    messageForm.requestSubmit();
  }
});

messageInput.addEventListener("input", () => {
  autoResize();
  if (!isTyping) {
    isTyping = true;
    socket.emit("typing", true);
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(stopTyping, 1500);
});

// ---------- Mobil menü ----------
function toggleSidebar(open) {
  sidebar.classList.toggle("open", open);
  backdrop.classList.toggle("show", open);
}
$("openSidebar").addEventListener("click", () => toggleSidebar(true));
$("closeSidebar").addEventListener("click", () => toggleSidebar(false));
backdrop.addEventListener("click", () => toggleSidebar(false));

// ---------- Socket olayları ----------
socket.on("message", addMessage);
socket.on("users", renderUsers);
socket.on("typing", ({ user, isTyping }) => {
  if (isTyping) typingUsers.add(user);
  else typingUsers.delete(user);
  renderTyping();
});

socket.on("disconnect", () => {
  $("topbarInfo").textContent = "Bağlantı koptu, yeniden bağlanılıyor…";
  typingUsers.clear();
  renderTyping();
});

// Bağlantı koparsa aynı adla otomatik tekrar katıl
socket.on("connect", () => {
  if (myName) join(myName);
});
