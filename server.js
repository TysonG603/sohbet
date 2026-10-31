const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e5 });

const PORT = process.env.PORT || 3000;
const HISTORY_LIMIT = 100;
const MAX_MESSAGE_LENGTH = 1000;

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.send("ok"));

// Bellekte tutulan son mesajlar ve çevrimiçi kullanıcılar
const history = [];
const users = new Map(); // socket.id -> username

function onlineList() {
  return [...new Set(users.values())].sort((a, b) => a.localeCompare(b, "tr"));
}

function pushHistory(entry) {
  history.push(entry);
  if (history.length > HISTORY_LIMIT) history.shift();
}

function systemMessage(text) {
  const msg = { type: "system", text, time: Date.now() };
  pushHistory(msg);
  io.emit("message", msg);
}

io.on("connection", (socket) => {
  socket.on("join", (rawName, ack) => {
    const name = String(rawName || "").trim().replace(/\s+/g, " ").slice(0, 20);
    if (name.length < 2) {
      return ack?.({ ok: false, error: "Kullanıcı adı en az 2 karakter olmalı." });
    }
    const taken = [...users.values()].some((u) => u.toLowerCase() === name.toLowerCase());
    if (taken) {
      return ack?.({ ok: false, error: "Bu kullanıcı adı şu an kullanımda." });
    }

    users.set(socket.id, name);
    ack?.({ ok: true, name, history });
    systemMessage(`${name} sohbete katıldı`);
    io.emit("users", onlineList());
  });

  socket.on("message", (rawText) => {
    const name = users.get(socket.id);
    if (!name) return;
    const text = String(rawText || "").trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text) return;

    const msg = { type: "chat", id: `${Date.now()}-${socket.id}`, user: name, text, time: Date.now() };
    pushHistory(msg);
    io.emit("message", msg);
  });

  socket.on("typing", (isTyping) => {
    const name = users.get(socket.id);
    if (name) socket.broadcast.emit("typing", { user: name, isTyping: !!isTyping });
  });

  socket.on("disconnect", () => {
    const name = users.get(socket.id);
    if (!name) return;
    users.delete(socket.id);
    socket.broadcast.emit("typing", { user: name, isTyping: false });
    systemMessage(`${name} sohbetten ayrıldı`);
    io.emit("users", onlineList());
  });
});

server.listen(PORT, () => {
  console.log(`Sohbet sunucusu http://localhost:${PORT} adresinde çalışıyor`);
});
