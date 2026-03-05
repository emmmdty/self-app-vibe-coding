const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const {
  HoldemRoom,
  randomId,
  normalizeName,
} = require('./engine/holdemRoom');

const PORT = Number(process.env.PORT || 3000);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
});

app.use(express.static(path.join(__dirname, 'client')));

const rooms = new Map();
const botTurnTimers = new Map();

function clearBotTurnTimer(roomId) {
  const key = String(roomId || '').toUpperCase();
  const timer = botTurnTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    botTurnTimers.delete(key);
  }
}

function emitError(socket, message, details) {
  socket.emit('room:error', { message, details: details || null });
}

function findRoomByPlayerId(playerId) {
  for (const room of rooms.values()) {
    if (room.getPlayer(playerId)) return room;
  }
  return null;
}

function findRoomBySocketId(socketId) {
  for (const room of rooms.values()) {
    const player = room.getPlayerBySocket(socketId);
    if (player) return { room, player };
  }
  return null;
}

function broadcastRoomState(room) {
  for (const player of room.players) {
    if (player.socketId) {
      io.to(player.socketId).emit('room:state', room.getStateFor(player.playerId));
    }
  }
  scheduleBotTurn(room);
}

function cleanupRoomIfEmpty(room) {
  const hasHuman = room.players.some((p) => !p.isBot);
  if (room.players.length === 0 || !hasHuman) {
    clearBotTurnTimer(room.roomId);
    rooms.delete(room.roomId);
  }
}

function joinSocketToRoom(socket, roomId) {
  for (const existing of socket.rooms) {
    if (existing !== socket.id) {
      socket.leave(existing);
    }
  }
  socket.join(roomId);
}

function requireRoom(roomId) {
  const room = rooms.get(String(roomId || '').toUpperCase());
  if (!room) {
    throw new Error('房间不存在');
  }
  return room;
}

function randomInt(min, max) {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chooseRandom(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function decideBotAction(room, botPlayerId) {
  const botState = room.getStateFor(botPlayerId);
  const me = botState?.me;
  if (!me || !me.canAct) return null;

  const legal = me.legalActions || {};
  const choices = Object.entries(legal)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([action]) => action);
  const action = chooseRandom(choices);
  if (!action) return null;

  if (action === 'raise') {
    const minRaiseTo = Number(me.raise?.minRaiseTo || 0);
    const maxRaiseTo = Number(me.raise?.maxRaiseTo || 0);
    if (!Number.isInteger(minRaiseTo) || !Number.isInteger(maxRaiseTo) || maxRaiseTo < minRaiseTo) {
      const fallback = choices.find((item) => item !== 'raise');
      return fallback ? { action: fallback } : null;
    }
    return {
      action,
      raiseTo: randomInt(minRaiseTo, maxRaiseTo),
    };
  }

  return { action };
}

function scheduleBotTurn(room) {
  if (!room || !room.roomId) return;
  clearBotTurnTimer(room.roomId);

  if (!room.hand || room.hand.currentTurnSeat == null) return;
  if (room.phase === 'LOBBY' || room.phase === 'HAND_END') return;

  const current = room.players.find((p) => p.seat === room.hand.currentTurnSeat);
  if (!current || !current.isBot || !current.inHand || current.folded || current.allIn) {
    return;
  }

  const delay = randomInt(350, 900);
  const timer = setTimeout(() => {
    botTurnTimers.delete(room.roomId);

    const freshRoom = rooms.get(room.roomId);
    if (!freshRoom) return;
    if (!freshRoom.hand || freshRoom.phase === 'LOBBY' || freshRoom.phase === 'HAND_END') return;

    const freshCurrent = freshRoom.players.find((p) => p.seat === freshRoom.hand.currentTurnSeat);
    if (!freshCurrent || !freshCurrent.isBot || !freshCurrent.inHand || freshCurrent.folded || freshCurrent.allIn) {
      return;
    }

    try {
      const decision = decideBotAction(freshRoom, freshCurrent.playerId);
      if (!decision) return;
      freshRoom.applyAction(freshCurrent.playerId, decision);
    } catch (error) {
      try {
        freshRoom.applyAction(freshCurrent.playerId, { action: 'fold' });
      } catch (_) {
        console.warn(`[bot] failed action in room ${freshRoom.roomId}: ${error.message}`);
      }
    }

    if (!rooms.has(freshRoom.roomId)) return;
    broadcastRoomState(freshRoom);
  }, delay);

  botTurnTimers.set(room.roomId, timer);
}

io.on('connection', (socket) => {
  socket.on('room:create', (payload = {}) => {
    try {
      const roomId = HoldemRoom.createRoomCode(new Set(rooms.keys()));
      const playerId = payload.playerId || randomId('p_');
      const room = new HoldemRoom({
        roomId,
        hostName: normalizeName(payload.name),
        hostSocketId: socket.id,
        playerId,
      });
      rooms.set(roomId, room);
      joinSocketToRoom(socket, roomId);
      socket.emit('room:joined', { roomId, playerId, host: true });
      broadcastRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('room:join', (payload = {}) => {
    try {
      const room = requireRoom(payload.roomId);
      if (!payload.playerId && room.isFull()) {
        throw new Error('房间已满');
      }

      const { player, rejoined, created } = room.addOrRejoinPlayer({
        playerId: payload.playerId,
        name: payload.name,
        socketId: socket.id,
      });

      joinSocketToRoom(socket, room.roomId);
      socket.emit('room:joined', {
        roomId: room.roomId,
        playerId: player.playerId,
        rejoined,
        created,
        host: room.hostPlayerId === player.playerId,
      });
      broadcastRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('room:rejoin', (payload = {}) => {
    try {
      const room = requireRoom(payload.roomId);
      if (!payload.playerId) {
        throw new Error('缺少 playerId');
      }
      const player = room.getPlayer(payload.playerId);
      if (!player) {
        throw new Error('房间中未找到该玩家，请重新加入');
      }
      room.addOrRejoinPlayer({
        playerId: payload.playerId,
        name: payload.name,
        socketId: socket.id,
      });
      joinSocketToRoom(socket, room.roomId);
      socket.emit('room:joined', {
        roomId: room.roomId,
        playerId: payload.playerId,
        rejoined: true,
        host: room.hostPlayerId === payload.playerId,
      });
      broadcastRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('room:syncRequest', (payload = {}) => {
    try {
      const room = requireRoom(payload.roomId);
      const player = room.getPlayer(payload.playerId);
      if (!player) throw new Error('玩家不存在');
      socket.emit('room:state', room.getStateFor(player.playerId));
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('room:ready', (payload = {}) => {
    try {
      const room = requireRoom(payload.roomId);
      room.setReady(payload.playerId, payload.ready);
      broadcastRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('room:updateSettings', (payload = {}) => {
    try {
      const room = requireRoom(payload.roomId);
      room.updateSettings(payload.playerId, {
        startingChips: payload.startingChips,
      });
      broadcastRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('room:start', (payload = {}) => {
    try {
      const room = requireRoom(payload.roomId);
      if (!room.session?.gameStarted) {
        room.startGame(payload.playerId);
      } else {
        room.startNextHand(payload.playerId);
      }
      broadcastRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('room:startGame', (payload = {}) => {
    try {
      const room = requireRoom(payload.roomId);
      room.startGame(payload.playerId);
      broadcastRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('room:nextHand', (payload = {}) => {
    try {
      const room = requireRoom(payload.roomId);
      room.startNextHand(payload.playerId);
      broadcastRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('room:resetGame', (payload = {}) => {
    try {
      const room = requireRoom(payload.roomId);
      room.resetGame(payload.playerId);
      broadcastRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('room:addBots', (payload = {}) => {
    try {
      const room = requireRoom(payload.roomId);
      const result = room.addBots(payload.playerId, Number(payload.count || 2));
      socket.emit('room:botsAdded', result);
      broadcastRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('room:leave', (payload = {}) => {
    try {
      const room = requireRoom(payload.roomId);
      room.removePlayer(payload.playerId);
      socket.leave(room.roomId);
      socket.emit('room:left', { roomId: room.roomId });
      cleanupRoomIfEmpty(room);
      if (rooms.has(room.roomId)) {
        broadcastRoomState(room);
      }
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('game:action', (payload = {}) => {
    try {
      const room = requireRoom(payload.roomId);
      room.applyAction(payload.playerId, {
        action: payload.action,
        raiseTo: payload.raiseTo,
      });
      broadcastRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('disconnect', () => {
    const found = findRoomBySocketId(socket.id);
    if (!found) return;
    found.room.markDisconnected(found.player.playerId);
    cleanupRoomIfEmpty(found.room);
    if (rooms.has(found.room.roomId)) {
      broadcastRoomState(found.room);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Texas Holdem multiplayer demo listening on http://localhost:${PORT}`);
});
