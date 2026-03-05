const crypto = require('crypto');
const { settleShowdown } = require('./payout');

const MAX_PLAYERS = 10;
const MAX_BOTS = 2;
const ROOM_PHASES = {
  LOBBY: 'LOBBY',
  PREFLOP: 'PREFLOP',
  FLOP: 'FLOP',
  TURN: 'TURN',
  RIVER: 'RIVER',
  SHOWDOWN: 'SHOWDOWN',
  HAND_END: 'HAND_END',
};

function randomId(prefix = '') {
  return `${prefix}${crypto.randomBytes(4).toString('hex')}`;
}

function normalizeName(name) {
  const trimmed = String(name || '').trim();
  return trimmed.slice(0, 16) || `Guest-${Math.floor(Math.random() * 1000)}`;
}

function createDeck() {
  const ranks = '23456789TJQKA'.split('');
  const suits = 'cdhs'.split('');
  const deck = [];
  for (const rank of ranks) {
    for (const suit of suits) {
      deck.push(`${rank}${suit}`);
    }
  }
  return deck;
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickLowestUnusedSeat(players) {
  const used = new Set(players.map((p) => p.seat));
  for (let seat = 0; seat < MAX_PLAYERS; seat += 1) {
    if (!used.has(seat)) return seat;
  }
  return -1;
}

class HoldemRoom {
  constructor({ roomId, hostName, hostSocketId, playerId }) {
    this.roomId = roomId;
    this.settings = {
      startingChips: 1000,
      smallBlind: 5,
      bigBlind: 10,
    };
    this.players = [];
    this.phase = ROOM_PHASES.LOBBY;
    this.handNumber = 0;
    this.hand = null;
    this.lastResult = null;
    this.session = {
      gameStarted: false,
      gameOver: false,
      handJustEnded: false,
      winnerPlayerId: null,
    };
    this.hostPlayerId = playerId;
    this.addPlayer({
      playerId,
      name: hostName,
      socketId: hostSocketId,
      asSpectator: false,
      initialStack: this.settings.startingChips,
    });
  }

  static createRoomCode(existingCodes = new Set()) {
    let code = '';
    do {
      code = Math.random().toString(36).slice(2, 6).toUpperCase();
    } while (existingCodes.has(code));
    return code;
  }

  getPlayer(playerId) {
    return this.players.find((p) => p.playerId === playerId) || null;
  }

  getPlayerBySocket(socketId) {
    return this.players.find((p) => p.socketId === socketId) || null;
  }

  getConnectedPlayers() {
    return this.players.filter((p) => p.connected);
  }

  getHumanPlayers() {
    return this.players.filter((p) => !p.isBot);
  }

  getBotPlayers() {
    return this.players.filter((p) => p.isBot);
  }

  getSortedPlayers() {
    return [...this.players].sort((a, b) => a.seat - b.seat);
  }

  getSeatedCount() {
    return this.players.length;
  }

  isFull() {
    return this.players.length >= MAX_PLAYERS;
  }

  addPlayer({
    playerId,
    name,
    socketId,
    asSpectator = false,
    initialStack,
    isBot = false,
  }) {
    if (this.isFull()) {
      throw new Error('房间已满');
    }
    const seat = pickLowestUnusedSeat(this.players);
    if (seat < 0) {
      throw new Error('房间已满');
    }
    const player = {
      playerId,
      name: normalizeName(name),
      socketId,
      connected: true,
      seat,
      ready: false,
      isBot: Boolean(isBot),
      isSpectator: Boolean(asSpectator),
      stack:
        typeof initialStack === 'number'
          ? initialStack
          : this.settings.startingChips,
      hand: [],
      inHand: false,
      folded: false,
      allIn: false,
      committedRound: 0,
      committedHand: 0,
      actedThisStreet: false,
      lastAction: '',
    };
    this.players.push(player);
    return player;
  }

  _nextBotName() {
    const usedNames = new Set(this.players.map((p) => p.name));
    let idx = 1;
    while (usedNames.has(`Bot-${idx}`)) idx += 1;
    return `Bot-${idx}`;
  }

  addBots(playerId, count = 2) {
    this._ensureHost(playerId);
    if (this.phase !== ROOM_PHASES.LOBBY) {
      throw new Error('牌局进行中，无法添加机器人');
    }

    const requested = Number(count);
    if (!Number.isInteger(requested) || requested <= 0) {
      throw new Error('机器人数量必须是正整数');
    }

    const existingBots = this.getBotPlayers();
    const remainingBotQuota = Math.max(0, MAX_BOTS - existingBots.length);
    if (remainingBotQuota <= 0) {
      throw new Error('机器人已存在（最多 2 个）');
    }

    const freeSeats = Math.max(0, MAX_PLAYERS - this.players.length);
    if (freeSeats <= 0) {
      throw new Error('房间已满');
    }

    const target = Math.min(requested, remainingBotQuota, freeSeats);
    const added = [];
    for (let i = 0; i < target; i += 1) {
      const bot = this.addPlayer({
        playerId: randomId('bot_'),
        name: this._nextBotName(),
        socketId: null,
        asSpectator: false,
        initialStack: this.settings.startingChips,
        isBot: true,
      });
      bot.ready = true;
      added.push(bot);
    }

    return {
      addedCount: added.length,
      playerIds: added.map((p) => p.playerId),
    };
  }

  addOrRejoinPlayer({ playerId, name, socketId }) {
    const normalizedPlayerId = playerId || randomId('p_');
    const existing = this.getPlayer(normalizedPlayerId);
    if (existing) {
      existing.socketId = socketId;
      existing.connected = true;
      if (name) existing.name = normalizeName(name);
      return { player: existing, rejoined: true, created: false };
    }

    const spectatorJoin = this.phase !== ROOM_PHASES.LOBBY;
    const player = this.addPlayer({
      playerId: normalizedPlayerId,
      name,
      socketId,
      asSpectator: spectatorJoin,
      initialStack: this.settings.startingChips,
    });
    return { player, rejoined: false, created: true };
  }

  markDisconnected(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return;
    if (player.isBot) return;
    player.connected = false;
    player.socketId = null;
    if (this.hand && player.inHand && !player.folded) {
      // Disconnecting mid-hand is treated as fold to unblock the table.
      this._applyFold(player, true);
      this._advanceAfterAction(player);
    }
  }

  removePlayer(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return;

    // If leaving during a hand, fold first so pot integrity is preserved.
    if (this.hand && player.inHand && !player.folded) {
      this._applyFold(player, true);
      this._advanceAfterAction(player);
    }

    this.players = this.players.filter((p) => p.playerId !== playerId);
    if (this.hostPlayerId === playerId) {
      const sorted = this.getSortedPlayers();
      const nextHost = sorted.find((p) => !p.isBot) || sorted[0];
      this.hostPlayerId = nextHost ? nextHost.playerId : null;
    }
  }

  updateSettings(playerId, { startingChips }) {
    this._ensureHost(playerId);
    if (this.phase !== ROOM_PHASES.LOBBY) {
      throw new Error('牌局进行中，无法修改设置');
    }
    const previousStartingChips = this.settings.startingChips;
    const value = Number(startingChips);
    if (!Number.isInteger(value) || value < 100 || value > 10000) {
      throw new Error('初始筹码必须是 100-10000 的整数');
    }
    this.settings.startingChips = value;
    for (const p of this.players) {
      if (
        (!p.ready || p.isBot) &&
        !p.inHand &&
        p.stack === previousStartingChips &&
        !p.isSpectator
      ) {
        p.stack = value;
      }
    }
  }

  setReady(playerId, ready) {
    const player = this._ensurePlayer(playerId);
    if (this.phase !== ROOM_PHASES.LOBBY) {
      throw new Error('对局进行中无法切换 Ready');
    }
    if (player.isSpectator || player.stack <= 0) {
      throw new Error('观战玩家不能 Ready');
    }
    player.ready = Boolean(ready);
  }

  canStartHand() {
    return this._getReadyParticipants().length >= 2 && this.phase === ROOM_PHASES.LOBBY;
  }

  startGame(playerId) {
    this._ensureHost(playerId);
    if (this.phase !== ROOM_PHASES.LOBBY) {
      throw new Error('牌局进行中，无法开始新游戏');
    }
    this.session.gameStarted = true;
    this.session.gameOver = false;
    this.session.handJustEnded = false;
    this.session.winnerPlayerId = null;
    this.startHand(playerId);
  }

  startNextHand(playerId) {
    this._ensureHost(playerId);
    if (!this.session.gameStarted) {
      throw new Error('请先开始游戏');
    }
    if (this.session.gameOver) {
      throw new Error('整局已结束，请重新开始');
    }
    if (this.phase !== ROOM_PHASES.LOBBY) {
      throw new Error('当前不能开始下一局');
    }
    this.session.handJustEnded = false;
    this.startHand(playerId);
  }

  resetGame(playerId) {
    this._ensureHost(playerId);
    if (this.hand || this.phase !== ROOM_PHASES.LOBBY) {
      throw new Error('请在每手结束后重置游戏');
    }

    for (const p of this.players) {
      p.isSpectator = false;
      p.stack = this.settings.startingChips;
      p.hand = [];
      p.inHand = false;
      p.folded = false;
      p.allIn = false;
      p.committedRound = 0;
      p.committedHand = 0;
      p.actedThisStreet = false;
      p.lastAction = '';
      p.ready = Boolean(p.isBot);
    }

    this.lastResult = null;
    this.phase = ROOM_PHASES.LOBBY;
    this.hand = null;
    this.handNumber = 0;
    this.session = {
      gameStarted: false,
      gameOver: false,
      handJustEnded: false,
      winnerPlayerId: null,
    };
  }

  startHand(playerId) {
    this._ensureHost(playerId);
    if (!this.canStartHand()) {
      throw new Error('至少 2 名玩家 Ready 才能开始');
    }

    if (!this.session.gameStarted) {
      this.session.gameStarted = true;
      this.session.gameOver = false;
      this.session.winnerPlayerId = null;
    }
    this.session.handJustEnded = false;
    this.lastResult = null;
    this.handNumber += 1;
    this.phase = ROOM_PHASES.PREFLOP;
    this.hand = {
      deck: shuffle(createDeck()),
      communityCards: [],
      dealerSeat: this._nextDealerSeat(),
      smallBlindSeat: null,
      bigBlindSeat: null,
      currentTurnSeat: null,
      currentBet: 0,
      minRaise: this.settings.bigBlind,
      actionLog: [`第 ${this.handNumber} 手开始`],
      startedAt: Date.now(),
    };

    const participants = this._getReadyParticipants();
    for (const p of this.players) {
      p.inHand = participants.some((pp) => pp.playerId === p.playerId);
      p.hand = p.inHand ? [this._draw(), this._draw()] : [];
      p.folded = !p.inHand;
      p.allIn = false;
      p.committedRound = 0;
      p.committedHand = 0;
      p.actedThisStreet = false;
      p.lastAction = '';
      if (!p.inHand) p.ready = false;
    }

    this._assignBlinds();
    this._postBlind(this.hand.smallBlindSeat, this.settings.smallBlind, 'small blind');
    this._postBlind(this.hand.bigBlindSeat, this.settings.bigBlind, 'big blind');
    this.hand.currentBet = this._maxCommittedRound();

    const firstTurn = this._findNextActionableSeat(this.hand.bigBlindSeat);
    this.hand.currentTurnSeat = firstTurn;

    if (firstTurn == null) {
      this._runoutAndShowdownIfNeeded();
    }
  }

  applyAction(playerId, payload) {
    if (!this.hand || this.phase === ROOM_PHASES.LOBBY || this.phase === ROOM_PHASES.HAND_END) {
      throw new Error('当前不在下注阶段');
    }

    const player = this._ensurePlayer(playerId);
    if (!player.inHand || player.folded || player.allIn) {
      throw new Error('当前玩家不能行动');
    }
    if (player.seat !== this.hand.currentTurnSeat) {
      throw new Error('还没轮到你');
    }

    const action = String(payload?.action || '').toLowerCase();
    if (!['check', 'call', 'raise', 'fold', 'allin'].includes(action)) {
      throw new Error('不支持的动作');
    }

    if (action === 'fold') {
      this._applyFold(player);
    } else if (action === 'check') {
      this._applyCheck(player);
    } else if (action === 'call') {
      this._applyCall(player);
    } else if (action === 'allin') {
      this._applyAllIn(player);
    } else if (action === 'raise') {
      this._applyRaise(player, payload.raiseTo);
    }

    this._advanceAfterAction(player);
  }

  getStateFor(playerId) {
    const me = this.getPlayer(playerId);
    const toCall = me && this.hand ? this._getToCall(me) : 0;

    return {
      roomId: this.roomId,
      phase: this.phase,
      hostPlayerId: this.hostPlayerId,
      handNumber: this.handNumber,
      settings: { ...this.settings },
      canStart: this.canStartHand(),
      session: {
        ...this.session,
        nextAction: this._nextSessionAction(),
      },
      lastResult: this.lastResult,
      players: this.getSortedPlayers().map((p) => ({
        playerId: p.playerId,
        name: p.name,
        seat: p.seat,
        connected: p.connected,
        ready: p.ready,
        isBot: p.isBot,
        isSpectator: p.isSpectator,
        stack: p.stack,
        inHand: p.inHand,
        folded: p.folded,
        allIn: p.allIn,
        committedRound: p.committedRound,
        committedHand: p.committedHand,
        lastAction: p.lastAction,
        holeCards:
          p.playerId === playerId || this.phase === ROOM_PHASES.HAND_END
            ? p.hand
            : p.inHand && !p.folded
            ? ['??', '??']
            : p.hand.length
            ? ['??', '??']
            : [],
      })),
      hand: this.hand
        ? {
            phase: this.phase,
            dealerSeat: this.hand.dealerSeat,
            smallBlindSeat: this.hand.smallBlindSeat,
            bigBlindSeat: this.hand.bigBlindSeat,
            currentTurnSeat: this.hand.currentTurnSeat,
            currentBet: this.hand.currentBet,
            minRaise: this.hand.minRaise,
            communityCards: [...this.hand.communityCards],
            pot: this._totalPot(),
            actionLog: [...this.hand.actionLog].slice(-20),
          }
        : null,
      me: me
        ? {
            playerId: me.playerId,
            toCall,
            canAct: this.hand ? me.seat === this.hand.currentTurnSeat && !me.folded && !me.allIn && me.inHand : false,
            legalActions: this._legalActionsFor(me),
            raise: this._raiseBoundsFor(me),
          }
        : null,
    };
  }

  _ensurePlayer(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) throw new Error('玩家不存在');
    return player;
  }

  _ensureHost(playerId) {
    if (this.hostPlayerId !== playerId) {
      throw new Error('只有房主可以执行此操作');
    }
  }

  _getReadyParticipants() {
    return this.getSortedPlayers().filter(
      (p) => p.ready && !p.isSpectator && p.stack > 0 && p.connected
    );
  }

  _bankrollEligiblePlayers() {
    return this.getSortedPlayers().filter((p) => !p.isSpectator && p.stack > 0);
  }

  _nextSessionAction() {
    if (!this.session?.gameStarted) return 'start-game';
    if (this.session.gameOver) return 'wait';
    if (this.phase !== ROOM_PHASES.LOBBY) return 'wait';
    if (this.session.handJustEnded) return 'next-hand';
    return 'wait';
  }

  _updateSessionAfterHandCleanup() {
    if (!this.session) {
      this.session = {
        gameStarted: false,
        gameOver: false,
        handJustEnded: false,
        winnerPlayerId: null,
      };
    }
    if (!this.session.gameStarted) {
      this.session.gameOver = false;
      this.session.handJustEnded = false;
      this.session.winnerPlayerId = null;
      return;
    }

    const remaining = this._bankrollEligiblePlayers();
    this.session.handJustEnded = true;
    if (remaining.length < 2) {
      this.session.gameOver = true;
      this.session.winnerPlayerId = remaining[0]?.playerId || null;
      this.session.handJustEnded = false;
    } else {
      this.session.gameOver = false;
      this.session.winnerPlayerId = null;
    }
  }

  _playersInCurrentHand() {
    return this.getSortedPlayers().filter((p) => p.inHand);
  }

  _activeNotFolded() {
    return this.getSortedPlayers().filter((p) => p.inHand && !p.folded);
  }

  _actionablePlayers() {
    return this.getSortedPlayers().filter(
      (p) => p.inHand && !p.folded && !p.allIn
    );
  }

  _nextDealerSeat() {
    const candidates = this._getReadyParticipants();
    if (!candidates.length) return 0;

    if (!this.lastResult || typeof this.lastResult.dealerSeat !== 'number') {
      return candidates[0].seat;
    }

    if (this.lastResult && typeof this.lastResult.dealerSeat === 'number') {
      const next = this._findNextSeatByPredicate(
        this.lastResult.dealerSeat,
        (p) => candidates.some((c) => c.playerId === p.playerId)
      );
      if (next != null) return next;
    }
    return candidates[0].seat;
  }

  _assignBlinds() {
    const handPlayers = this._playersInCurrentHand();
    if (handPlayers.length < 2) {
      throw new Error('牌桌玩家不足 2 人');
    }

    this.hand.smallBlindSeat = this._findNextSeatByPredicate(
      this.hand.dealerSeat,
      (p) => p.inHand
    );
    this.hand.bigBlindSeat = this._findNextSeatByPredicate(
      this.hand.smallBlindSeat,
      (p) => p.inHand
    );
  }

  _draw() {
    return this.hand.deck.pop();
  }

  _playerAtSeat(seat) {
    return this.players.find((p) => p.seat === seat) || null;
  }

  _findNextSeatByPredicate(fromSeat, predicate) {
    const sorted = this.getSortedPlayers();
    if (!sorted.length) return null;
    const seats = sorted.map((p) => p.seat);
    const startIdx = Math.max(seats.findIndex((s) => s === fromSeat), 0);
    for (let step = 1; step <= sorted.length; step += 1) {
      const idx = (startIdx + step) % sorted.length;
      const p = sorted[idx];
      if (predicate(p)) return p.seat;
    }
    return null;
  }

  _findNextActionableSeat(fromSeat) {
    return this._findNextSeatByPredicate(
      fromSeat,
      (p) => p.inHand && !p.folded && !p.allIn
    );
  }

  _postBlind(seat, blindAmount, label) {
    if (seat == null) return;
    const player = this._playerAtSeat(seat);
    if (!player || !player.inHand) return;
    const amount = Math.min(player.stack, blindAmount);
    player.stack -= amount;
    player.committedRound += amount;
    player.committedHand += amount;
    player.allIn = player.stack === 0;
    player.lastAction = label;
    this.hand.actionLog.push(`${player.name} posts ${label} ${amount}`);
  }

  _maxCommittedRound() {
    return this._playersInCurrentHand().reduce(
      (max, p) => Math.max(max, p.committedRound),
      0
    );
  }

  _getToCall(player) {
    if (!this.hand) return 0;
    return Math.max(0, this.hand.currentBet - player.committedRound);
  }

  _legalActionsFor(player) {
    if (!this.hand || player.seat !== this.hand.currentTurnSeat) {
      return {
        check: false,
        call: false,
        raise: false,
        fold: false,
        allin: false,
      };
    }
    if (player.folded || player.allIn || !player.inHand) {
      return {
        check: false,
        call: false,
        raise: false,
        fold: false,
        allin: false,
      };
    }
    const toCall = this._getToCall(player);
    const stack = player.stack;
    const minRaiseTo = this._minRaiseTo();
    return {
      check: toCall === 0,
      call: toCall > 0 && stack >= toCall,
      raise: stack > toCall && player.committedRound + stack >= minRaiseTo,
      fold: true,
      allin: stack > 0,
    };
  }

  _raiseBoundsFor(player) {
    if (!this.hand) return null;
    const toCall = this._getToCall(player);
    const maxRaiseTo = player.committedRound + player.stack;
    return {
      toCall,
      minRaiseTo: this._minRaiseTo(),
      maxRaiseTo,
    };
  }

  _minRaiseTo() {
    if (!this.hand) return 0;
    if (this.hand.currentBet === 0) return this.settings.bigBlind;
    return this.hand.currentBet + this.hand.minRaise;
  }

  _commitChips(player, amount) {
    if (amount <= 0) return 0;
    const committed = Math.min(player.stack, amount);
    player.stack -= committed;
    player.committedRound += committed;
    player.committedHand += committed;
    if (player.stack === 0) player.allIn = true;
    return committed;
  }

  _applyFold(player, silent = false) {
    player.folded = true;
    player.actedThisStreet = true;
    player.lastAction = 'fold';
    if (!silent) this.hand.actionLog.push(`${player.name} folds`);
  }

  _applyCheck(player) {
    if (this._getToCall(player) !== 0) {
      throw new Error('当前不能 check');
    }
    player.actedThisStreet = true;
    player.lastAction = 'check';
    this.hand.actionLog.push(`${player.name} checks`);
  }

  _applyCall(player) {
    const toCall = this._getToCall(player);
    if (toCall <= 0) {
      throw new Error('当前无需 call');
    }
    if (player.stack < toCall) {
      throw new Error('筹码不足，请使用 all-in');
    }
    this._commitChips(player, toCall);
    player.actedThisStreet = true;
    player.lastAction = 'call';
    this.hand.actionLog.push(`${player.name} calls ${toCall}`);
  }

  _applyRaise(player, rawRaiseTo) {
    const raiseTo = Number(rawRaiseTo);
    if (!Number.isInteger(raiseTo)) {
      throw new Error('加注金额必须是整数');
    }
    const toCall = this._getToCall(player);
    const minRaiseTo = this._minRaiseTo();
    const currentTotal = player.committedRound;
    const maxRaiseTo = currentTotal + player.stack;
    if (raiseTo <= this.hand.currentBet) {
      throw new Error('加注后总投入必须高于当前最高下注');
    }
    if (raiseTo < minRaiseTo) {
      throw new Error(`最小加注到 ${minRaiseTo}`);
    }
    if (raiseTo > maxRaiseTo) {
      throw new Error('筹码不足以完成该加注');
    }
    const commitAmount = raiseTo - currentTotal;
    this._commitChips(player, commitAmount);
    this._onRaise(player, raiseTo, `raises to ${raiseTo}`);
  }

  _applyAllIn(player) {
    if (player.stack <= 0) {
      throw new Error('没有可用筹码');
    }
    const commitAmount = player.stack;
    const beforeCommitted = player.committedRound;
    this._commitChips(player, commitAmount);
    const raiseTo = player.committedRound;
    const isRaise = raiseTo > this.hand.currentBet && raiseTo >= this._minRaiseTo();

    if (isRaise) {
      this._onRaise(player, raiseTo, `goes all-in to ${raiseTo}`);
      return;
    }

    player.actedThisStreet = true;
    player.lastAction = 'all-in';
    if (beforeCommitted + commitAmount < this.hand.currentBet) {
      this.hand.actionLog.push(`${player.name} calls all-in for ${commitAmount}`);
    } else {
      this.hand.actionLog.push(`${player.name} goes all-in ${commitAmount}`);
    }
  }

  _onRaise(player, raiseTo, logText) {
    this.hand.currentBet = raiseTo;
    player.actedThisStreet = true;
    player.lastAction = player.allIn ? 'raise all-in' : 'raise';

    for (const other of this._actionablePlayers()) {
      if (other.playerId !== player.playerId) {
        other.actedThisStreet = false;
      }
    }

    this.hand.actionLog.push(`${player.name} ${logText}`);
  }

  _advanceAfterAction(actor) {
    const remaining = this._activeNotFolded();
    if (remaining.length === 1) {
      this._awardSingleWinner(remaining[0]);
      return;
    }

    const actionable = this._actionablePlayers();
    if (actionable.length === 0) {
      this._runoutAndShowdownIfNeeded();
      return;
    }

    if (this._isStreetComplete()) {
      this._advanceStreetOrShowdown();
      return;
    }

    this.hand.currentTurnSeat = this._findNextActionableSeat(actor.seat);
  }

  _isStreetComplete() {
    const actionable = this._actionablePlayers();
    if (!actionable.length) return true;
    return actionable.every(
      (p) => p.actedThisStreet && p.committedRound === this.hand.currentBet
    );
  }

  _advanceStreetOrShowdown() {
    const streetOrder = [
      ROOM_PHASES.PREFLOP,
      ROOM_PHASES.FLOP,
      ROOM_PHASES.TURN,
      ROOM_PHASES.RIVER,
    ];
    const idx = streetOrder.indexOf(this.phase);
    if (idx === -1) return;

    if (this.phase === ROOM_PHASES.RIVER) {
      this._goToShowdown();
      return;
    }

    if (this.phase === ROOM_PHASES.PREFLOP) {
      this.phase = ROOM_PHASES.FLOP;
      this.hand.communityCards.push(this._draw(), this._draw(), this._draw());
      this.hand.actionLog.push('Flop dealt');
    } else if (this.phase === ROOM_PHASES.FLOP) {
      this.phase = ROOM_PHASES.TURN;
      this.hand.communityCards.push(this._draw());
      this.hand.actionLog.push('Turn dealt');
    } else if (this.phase === ROOM_PHASES.TURN) {
      this.phase = ROOM_PHASES.RIVER;
      this.hand.communityCards.push(this._draw());
      this.hand.actionLog.push('River dealt');
    }

    for (const p of this._playersInCurrentHand()) {
      p.committedRound = 0;
      p.actedThisStreet = false;
      if (!p.folded) p.lastAction = '';
    }
    this.hand.currentBet = 0;
    this.hand.currentTurnSeat = this._findNextActionableSeat(this.hand.dealerSeat);

    if (this.hand.currentTurnSeat == null) {
      this._runoutAndShowdownIfNeeded();
    }
  }

  _runoutAndShowdownIfNeeded() {
    while (this.hand.communityCards.length < 5) {
      this.hand.communityCards.push(this._draw());
      const stageName =
        this.hand.communityCards.length === 3
          ? 'Flop'
          : this.hand.communityCards.length === 4
          ? 'Turn'
          : 'River';
      this.hand.actionLog.push(`${stageName} dealt (auto runout)`);
    }

    this.phase = ROOM_PHASES.RIVER;
    this._goToShowdown();
  }

  _awardSingleWinner(winner) {
    const totalPot = this._totalPot();
    winner.stack += totalPot;
    this.phase = ROOM_PHASES.HAND_END;
    this.lastResult = {
      type: 'fold-win',
      winnerIds: [winner.playerId],
      winnerNames: [winner.name],
      payouts: { [winner.playerId]: totalPot },
      pots: [
        {
          amount: totalPot,
          eligiblePlayerIds: [winner.playerId],
          winnerIds: [winner.playerId],
        },
      ],
      dealerSeat: this.hand?.dealerSeat ?? 0,
      message: `${winner.name} wins ${totalPot}（其他玩家弃牌）`,
    };
    this._endHandCleanup();
  }

  _goToShowdown() {
    this.phase = ROOM_PHASES.SHOWDOWN;
    const participants = this._playersInCurrentHand().map((p) => ({
      playerId: p.playerId,
      name: p.name,
      committedHand: p.committedHand,
      folded: p.folded,
      holeCards: p.hand,
    }));
    const result = settleShowdown({
      communityCards: [...this.hand.communityCards],
      players: participants,
    });

    for (const [playerId, amount] of Object.entries(result.payouts)) {
      const player = this.getPlayer(playerId);
      if (player) player.stack += amount;
    }

    const winners = Object.keys(result.payouts)
      .filter((id) => result.payouts[id] > 0)
      .map((id) => this.getPlayer(id))
      .filter(Boolean);

    this.phase = ROOM_PHASES.HAND_END;
    this.lastResult = {
      type: 'showdown',
      winnerIds: winners.map((w) => w.playerId),
      winnerNames: winners.map((w) => w.name),
      payouts: result.payouts,
      pots: result.pots,
      dealerSeat: this.hand.dealerSeat,
      communityCards: [...this.hand.communityCards],
      message:
        winners.length > 0
          ? `Showdown: ${winners.map((w) => w.name).join(', ')}`
          : 'Showdown complete',
    };
    this.hand.actionLog.push(this.lastResult.message);
    this._endHandCleanup();
  }

  _endHandCleanup() {
    for (const player of this.players) {
      if (player.stack <= 0) {
        player.isSpectator = true;
        player.ready = false;
      }
      player.inHand = false;
      player.folded = false;
      player.allIn = false;
      player.committedRound = 0;
      player.committedHand = 0;
      player.actedThisStreet = false;
      player.lastAction = '';
    }
    const finalHand = this.hand;
    this.hand = null;
    this.phase = ROOM_PHASES.LOBBY;
    if (this.lastResult) {
      this.lastResult.dealerSeat = finalHand?.dealerSeat ?? 0;
    }
    this._updateSessionAfterHandCleanup();
  }

  _totalPot() {
    return this.players.reduce((sum, p) => sum + p.committedHand, 0);
  }
}

module.exports = {
  HoldemRoom,
  ROOM_PHASES,
  MAX_PLAYERS,
  MAX_BOTS,
  randomId,
  normalizeName,
};
