import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { initGame, applyAction, sanitize } from './game/rules.js';

const app = express();
app.use(cors({ origin: '*' }));

const rooms = new Map();

app.get('/', (_, res) => res.send('🃏 Durak server is running'));
app.get('/health', (_, res) => res.json({ ok: true, rooms: rooms.size }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode() {
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
  } while (rooms.has(code));
  return code;
}

function broadcastState(room) {
  if (!room.state) return;
  room.players.forEach((socketId, idx) => {
    io.to(socketId).emit('state', sanitize(room.state, idx));
  });
}

io.on('connection', (socket) => {
  console.log('🔌 Connected:', socket.id);

  socket.on('createRoom', ({ name } = {}, cb) => {
    const roomId = generateCode();
    rooms.set(roomId, {
      players: [socket.id],
      names: [name || 'Игрок 1'],
      state: null,
    });
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerIndex = 0;
    cb?.({ ok: true, roomId, playerIndex: 0 });
    console.log('🏠 Room created:', roomId);
  });

  socket.on('joinRoom', ({ roomId, name } = {}, cb) => {
    const code = String(roomId || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return cb?.({ ok: false, error: 'Комната не найдена' });
    if (room.players.length >= 2) return cb?.({ ok: false, error: 'Комната полна' });

    room.players.push(socket.id);
    room.names.push(name || 'Игрок 2');
    socket.join(code);
    socket.data.roomId = code;
    socket.data.playerIndex = 1;

    room.state = initGame();
    broadcastState(room);

    cb?.({ ok: true, roomId: code, playerIndex: 1 });
    console.log('👥 Player joined:', code);
  });

  socket.on('action', ({ action, payload } = {}, cb) => {
    const roomId = socket.data.roomId;
    const idx = socket.data.playerIndex;
    const room = rooms.get(roomId);
    if (!room || !room.state) return cb?.({ ok: false, error: 'Нет комнаты' });

    const res = applyAction(room.state, idx, action, payload || {});
    if (res.error) return cb?.({ ok: false, error: res.error });

    room.state = res.state;
    broadcastState(room);
    cb?.({ ok: true });
  });

  socket.on('rematch', () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    room.state = initGame();
    broadcastState(room);
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    io.to(roomId).emit('opponentLeft');
    rooms.delete(roomId);
    console.log('❌ Disconnected, room closed:', roomId);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () =>
  console.log(`🃏 Durak server: http://localhost:${PORT}`)
);