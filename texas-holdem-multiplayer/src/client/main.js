/* global io */

const socket = io({
  transports: ['websocket', 'polling'],
});

const els = {
  connectPanel: document.getElementById('connect-panel'),
  roomPanel: document.getElementById('room-panel'),
  connStatus: document.getElementById('conn-status'),
  nameInput: document.getElementById('name-input'),
  roomInput: document.getElementById('room-input'),
  createBtn: document.getElementById('create-btn'),
  joinBtn: document.getElementById('join-btn'),
  rejoinBtn: document.getElementById('rejoin-btn'),
  rulesBtn: document.getElementById('rules-btn'),
  rulesDialog: document.getElementById('rules-dialog'),
  rulesCloseBtn: document.getElementById('rules-close-btn'),
  soundToggleBtn: document.getElementById('sound-toggle-btn'),
  fxToggleBtn: document.getElementById('fx-toggle-btn'),
  roomCodeText: document.getElementById('room-code-text'),
  phaseText: document.getElementById('phase-text'),
  sessionText: document.getElementById('session-text'),
  copyLinkBtn: document.getElementById('copy-link-btn'),
  leaveRoomBtn: document.getElementById('leave-room-btn'),
  startingChipsInput: document.getElementById('starting-chips-input'),
  saveSettingsBtn: document.getElementById('save-settings-btn'),
  readyBtn: document.getElementById('ready-btn'),
  startGameBtn: document.getElementById('start-game-btn'),
  nextHandBtn: document.getElementById('next-hand-btn'),
  resetGameBtn: document.getElementById('reset-game-btn'),
  addBotsBtn: document.getElementById('add-bots-btn'),
  tableFelt: document.getElementById('table-felt'),
  tableStatusLine: document.getElementById('table-status-line'),
  potStat: document.getElementById('pot-stat'),
  topBetStat: document.getElementById('top-bet-stat'),
  turnSeatStat: document.getElementById('turn-seat-stat'),
  potText: document.getElementById('pot-text'),
  topBetText: document.getElementById('top-bet-text'),
  turnSeatText: document.getElementById('turn-seat-text'),
  communityBoard: document.getElementById('community-board'),
  playersRing: document.getElementById('players-ring'),
  playersList: document.getElementById('players-list'),
  myStatus: document.getElementById('my-status'),
  actionPanel: document.getElementById('action-panel'),
  checkBtn: document.getElementById('check-btn'),
  callBtn: document.getElementById('call-btn'),
  foldBtn: document.getElementById('fold-btn'),
  allinBtn: document.getElementById('allin-btn'),
  raiseToInput: document.getElementById('raise-to-input'),
  raiseBtn: document.getElementById('raise-btn'),
  resultBox: document.getElementById('result-box'),
  actionLog: document.getElementById('action-log'),
  logToggleBtn: document.getElementById('log-toggle-btn'),
  toast: document.getElementById('toast'),
};

const STORAGE = {
  playerId: 'thm_player_id',
  playerName: 'thm_player_name',
  roomId: 'thm_room_id',
  soundEnabled: 'thm_ui_sound_enabled',
  motionOverride: 'thm_ui_motion_override',
  logCollapsed: 'thm_ui_log_collapsed',
};

const session = {
  playerId: localStorage.getItem(STORAGE.playerId) || '',
  playerName: localStorage.getItem(STORAGE.playerName) || '',
  roomId: localStorage.getItem(STORAGE.roomId) || '',
};

const uiPrefs = {
  soundEnabled: localStorage.getItem(STORAGE.soundEnabled) !== 'false',
  motionOverride: localStorage.getItem(STORAGE.motionOverride) || 'auto',
  logCollapsed: localStorage.getItem(STORAGE.logCollapsed) === 'true',
};

const motionQuery = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;

const audio = {
  ctx: null,
  unlocked: false,
  lastDealAt: 0,
};

let latestState = null;
let hasAutoTriedRejoin = false;
let bustToastSeenForHand = 0;
let toastTimer = 0;
let activeClassTimers = new WeakMap();
let resizeRaf = 0;

const AVATAR_ASSETS = Array.from({ length: 12 }, (_, i) => `/assets/avatars/avatar-${String(i + 1).padStart(2, '0')}.svg`);
const BOT_AVATAR_ASSETS = Array.from({ length: 4 }, (_, i) => `/assets/avatars/bot-${String(i + 1).padStart(2, '0')}.svg`);

const queryRoomId = new URLSearchParams(window.location.search).get('roomId');
if (queryRoomId) {
  els.roomInput.value = queryRoomId.toUpperCase();
}
if (session.playerName) {
  els.nameInput.value = session.playerName;
}

function supportsWebAudio() {
  return Boolean(window.AudioContext || window.webkitAudioContext);
}

function getAudioContext() {
  if (!supportsWebAudio()) return null;
  if (!audio.ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new Ctor();
  }
  return audio.ctx;
}

async function unlockAudio() {
  if (!uiPrefs.soundEnabled || !supportsWebAudio()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    audio.unlocked = ctx.state === 'running';
  } catch (_) {
    audio.unlocked = false;
  }
}

function scheduleTone(ctx, {
  time = ctx.currentTime,
  frequency = 440,
  type = 'sine',
  duration = 0.08,
  gain = 0.03,
  attack = 0.008,
  release = 0.05,
  detune = 0,
} = {}) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = type;
  osc.frequency.value = frequency;
  osc.detune.value = detune;

  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), time + Math.max(attack, 0.001));
  amp.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(duration, 0.02) + Math.max(release, 0.01));

  osc.connect(amp);
  amp.connect(ctx.destination);

  osc.start(time);
  osc.stop(time + duration + release + 0.02);
}

function playFx(name) {
  if (!uiPrefs.soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== 'running') return;

  const now = performance.now();
  if (name === 'deal' && now - audio.lastDealAt < 42) {
    return;
  }
  if (name === 'deal') {
    audio.lastDealAt = now;
  }

  const t = ctx.currentTime + 0.005;
  try {
    switch (name) {
      case 'join':
        scheduleTone(ctx, { time: t, frequency: 520, type: 'triangle', gain: 0.024, duration: 0.06 });
        scheduleTone(ctx, { time: t + 0.07, frequency: 660, type: 'triangle', gain: 0.022, duration: 0.06 });
        break;
      case 'ready':
        scheduleTone(ctx, { time: t, frequency: 700, type: 'sine', gain: 0.02, duration: 0.04 });
        break;
      case 'start':
        scheduleTone(ctx, { time: t, frequency: 420, type: 'triangle', gain: 0.02, duration: 0.05 });
        scheduleTone(ctx, { time: t + 0.055, frequency: 560, type: 'triangle', gain: 0.023, duration: 0.06 });
        break;
      case 'deal':
        scheduleTone(ctx, { time: t, frequency: 820, type: 'square', gain: 0.010, duration: 0.018, release: 0.02 });
        break;
      case 'check':
        scheduleTone(ctx, { time: t, frequency: 380, type: 'sine', gain: 0.016, duration: 0.03 });
        break;
      case 'call':
        scheduleTone(ctx, { time: t, frequency: 460, type: 'triangle', gain: 0.018, duration: 0.035 });
        break;
      case 'raise':
        scheduleTone(ctx, { time: t, frequency: 470, type: 'triangle', gain: 0.02, duration: 0.04 });
        scheduleTone(ctx, { time: t + 0.045, frequency: 620, type: 'triangle', gain: 0.02, duration: 0.04 });
        break;
      case 'allin':
        scheduleTone(ctx, { time: t, frequency: 330, type: 'sawtooth', gain: 0.018, duration: 0.06, release: 0.05 });
        scheduleTone(ctx, { time: t + 0.06, frequency: 520, type: 'sawtooth', gain: 0.018, duration: 0.08, release: 0.06 });
        break;
      case 'fold':
        scheduleTone(ctx, { time: t, frequency: 220, type: 'triangle', gain: 0.018, duration: 0.05 });
        break;
      case 'win':
        scheduleTone(ctx, { time: t, frequency: 520, type: 'triangle', gain: 0.02, duration: 0.05 });
        scheduleTone(ctx, { time: t + 0.06, frequency: 660, type: 'triangle', gain: 0.02, duration: 0.06 });
        scheduleTone(ctx, { time: t + 0.13, frequency: 820, type: 'triangle', gain: 0.018, duration: 0.08 });
        break;
      case 'turn':
        scheduleTone(ctx, { time: t, frequency: 610, type: 'sine', gain: 0.016, duration: 0.03 });
        break;
      case 'error':
        scheduleTone(ctx, { time: t, frequency: 240, type: 'square', gain: 0.012, duration: 0.03, release: 0.03 });
        scheduleTone(ctx, { time: t + 0.04, frequency: 190, type: 'square', gain: 0.012, duration: 0.03, release: 0.03 });
        break;
      default:
        scheduleTone(ctx, { time: t, frequency: 500, type: 'sine', gain: 0.014, duration: 0.03 });
        break;
    }
  } catch (_) {
    // Audio failures should not impact gameplay.
  }
}

function installAudioUnlockListeners() {
  const unlock = () => {
    unlockAudio();
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

function systemPrefersReducedMotion() {
  return Boolean(motionQuery && motionQuery.matches);
}

function isReducedMotionEnabled() {
  return uiPrefs.motionOverride === 'reduced' || systemPrefersReducedMotion();
}

function persistUiPrefs() {
  localStorage.setItem(STORAGE.soundEnabled, String(uiPrefs.soundEnabled));
  localStorage.setItem(STORAGE.motionOverride, uiPrefs.motionOverride);
  localStorage.setItem(STORAGE.logCollapsed, String(uiPrefs.logCollapsed));
}

function applyUiPrefs() {
  document.body.classList.toggle('reduced-motion', isReducedMotionEnabled());
  document.body.classList.toggle('muted-audio', !uiPrefs.soundEnabled);
  if (els.soundToggleBtn) {
    els.soundToggleBtn.textContent = `音效：${uiPrefs.soundEnabled ? '开' : '关'}`;
    els.soundToggleBtn.setAttribute('aria-pressed', String(uiPrefs.soundEnabled));
  }
  if (els.fxToggleBtn) {
    const motionLabel = uiPrefs.motionOverride === 'reduced' ? '减弱' : '自动';
    els.fxToggleBtn.textContent = `动效：${motionLabel}`;
    els.fxToggleBtn.setAttribute('aria-pressed', String(uiPrefs.motionOverride !== 'auto'));
  }
  if (els.logToggleBtn) {
    const panel = els.logToggleBtn.closest('.log-panel');
    if (panel) {
      panel.classList.toggle('collapsed', uiPrefs.logCollapsed);
    }
    els.logToggleBtn.textContent = uiPrefs.logCollapsed ? '展开日志' : '折叠日志';
    els.logToggleBtn.setAttribute('aria-pressed', String(uiPrefs.logCollapsed));
  }
}

function cycleMotionPreference() {
  uiPrefs.motionOverride = uiPrefs.motionOverride === 'auto' ? 'reduced' : 'auto';
  persistUiPrefs();
  applyUiPrefs();
  toast(uiPrefs.motionOverride === 'auto' ? '动效模式：自动（遵循系统设置）' : '动效模式：减弱');
}

function toggleSoundPreference() {
  uiPrefs.soundEnabled = !uiPrefs.soundEnabled;
  persistUiPrefs();
  applyUiPrefs();
  if (uiPrefs.soundEnabled) {
    unlockAudio().then(() => playFx('ready'));
  } else {
    toast('已静音');
  }
}

function toast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  els.toast.classList.remove('showing');
  if (!isReducedMotionEnabled()) {
    void els.toast.offsetWidth;
    els.toast.classList.add('showing');
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.add('hidden');
    els.toast.classList.remove('showing');
  }, 2400);
}

function openRulesDialog() {
  const dialog = els.rulesDialog;
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') {
    if (!dialog.open) dialog.showModal();
    return;
  }
  dialog.setAttribute('open', 'open');
}

function closeRulesDialog() {
  const dialog = els.rulesDialog;
  if (!dialog) return;
  if (typeof dialog.close === 'function') {
    if (dialog.open) dialog.close();
    return;
  }
  dialog.removeAttribute('open');
}

function getSessionMeta(state) {
  const raw = state?.session || {};
  return {
    gameStarted: Boolean(raw.gameStarted),
    gameOver: Boolean(raw.gameOver),
    handJustEnded: Boolean(raw.handJustEnded),
    winnerPlayerId: raw.winnerPlayerId || null,
    nextAction: raw.nextAction || (raw.gameStarted ? 'wait' : 'start-game'),
  };
}

function setVisible(el, visible) {
  if (!el) return;
  el.classList.toggle('hidden', !visible);
}

function sessionStatusText(state) {
  const meta = getSessionMeta(state);
  if (!meta.gameStarted) return '整局：未开始';
  if (meta.gameOver) {
    const winner = (state.players || []).find((p) => p.playerId === meta.winnerPlayerId);
    return winner ? `整局结束：${winner.name} 获胜` : '整局结束';
  }
  if (state.phase !== 'LOBBY') return '整局进行中';
  if (meta.nextAction === 'next-hand') return '等待房主开始下一局';
  return '等待房主操作';
}

function setConnStatus(text) {
  els.connStatus.textContent = text;
}

function persistSession() {
  if (session.playerId) localStorage.setItem(STORAGE.playerId, session.playerId);
  if (session.playerName) localStorage.setItem(STORAGE.playerName, session.playerName);
  if (session.roomId) localStorage.setItem(STORAGE.roomId, session.roomId);
}

function clearRoomSession() {
  session.roomId = '';
  latestState = null;
  localStorage.removeItem(STORAGE.roomId);
  window.history.replaceState({}, '', window.location.pathname);
  renderDisconnectedRoom();
}

function ensureName() {
  const name = (els.nameInput.value || '').trim();
  if (!name) {
    toast('请输入昵称');
    throw new Error('missing name');
  }
  session.playerName = name.slice(0, 16);
  persistSession();
  return session.playerName;
}

function currentPlayerEntry() {
  if (!latestState || !session.playerId) return null;
  return latestState.players.find((p) => p.playerId === session.playerId) || null;
}

function updateUrlRoomId(roomId) {
  const url = new URL(window.location.href);
  url.searchParams.set('roomId', roomId);
  window.history.replaceState({}, '', url.toString());
}

function emitCreate() {
  try {
    const name = ensureName();
    unlockAudio();
    socket.emit('room:create', {
      name,
      playerId: session.playerId || undefined,
    });
  } catch (_) {
    // no-op
  }
}

function emitJoin() {
  try {
    const name = ensureName();
    const roomId = (els.roomInput.value || '').trim().toUpperCase();
    if (!roomId) {
      toast('请输入房间号');
      return;
    }
    unlockAudio();
    socket.emit('room:join', {
      roomId,
      name,
      playerId: session.playerId || undefined,
    });
  } catch (_) {
    // no-op
  }
}

function emitRejoin() {
  const roomId = (els.roomInput.value || session.roomId || '').trim().toUpperCase();
  const playerId = session.playerId;
  if (!roomId || !playerId) {
    toast('缺少 roomId 或 playerId，无法重连');
    return;
  }
  unlockAudio();
  socket.emit('room:rejoin', {
    roomId,
    playerId,
    name: (els.nameInput.value || session.playerName || '').trim(),
  });
}

function sendAction(action, extra = {}) {
  if (!latestState || !session.roomId || !session.playerId) return;
  unlockAudio();
  socket.emit('game:action', {
    roomId: session.roomId,
    playerId: session.playerId,
    action,
    ...extra,
  });
}

function phaseLabel(phase) {
  const labels = {
    LOBBY: '等待区',
    PREFLOP: '翻牌前下注',
    FLOP: 'Flop 下注',
    TURN: 'Turn 下注',
    RIVER: 'River 下注',
    SHOWDOWN: '摊牌',
    HAND_END: '手牌结束',
  };
  return labels[phase] || phase || '-';
}

function setTableStatusLine(message) {
  if (!els.tableStatusLine) return;
  els.tableStatusLine.textContent = message;
}

function renderDisconnectedRoom() {
  els.roomPanel.classList.add('hidden');
  els.connectPanel.classList.remove('hidden');
  els.roomCodeText.textContent = '-';
  els.phaseText.textContent = '阶段：等待区';
  if (els.sessionText) els.sessionText.textContent = '整局：未开始';
  if (els.playersRing) {
    els.playersRing.innerHTML = '';
    delete els.playersRing.dataset.count;
  }
  els.playersList.innerHTML = '';
  els.communityBoard.innerHTML = '';
  els.actionLog.innerHTML = '';
  els.resultBox.textContent = '';
  els.resultBox.classList.remove('win-self');
  els.myStatus.textContent = '等待房间状态...';
  els.potText.textContent = '0';
  els.topBetText.textContent = '0';
  els.turnSeatText.textContent = '-';
  if (els.startGameBtn) setVisible(els.startGameBtn, true);
  if (els.nextHandBtn) setVisible(els.nextHandBtn, false);
  if (els.resetGameBtn) setVisible(els.resetGameBtn, true);
  setTableStatusLine('等待房间开始');
  setActionButtons({ check: false, call: false, fold: false, allin: false, raise: false });
  renderCommunityBoard([], []);
}

function formatPayouts(lastResult, players) {
  if (!lastResult) return '';
  const payouts = Object.entries(lastResult.payouts || {});
  if (!payouts.length) return lastResult.message || '';
  const idToName = new Map((players || []).map((p) => [p.playerId, p.name]));
  return [
    lastResult.message || '',
    ...payouts.map(([playerId, amount]) => `${idToName.get(playerId) || playerId}: +${amount}`),
    (lastResult.pots || [])
      .map((pot, idx) => `池${idx + 1}: ${pot.amount} -> ${(pot.winnerIds || []).map((id) => idToName.get(id) || id).join(', ')}`)
      .join('\n'),
  ]
    .filter(Boolean)
    .join('\n');
}

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function isRedSuitCard(cardCode) {
  return /[hd]$/i.test(String(cardCode || ''));
}

function parseCardCode(cardCode) {
  const raw = String(cardCode || '').trim();
  if (!raw) return null;
  if (raw === '??') return { kind: 'back' };
  const rank = raw[0]?.toUpperCase();
  const suit = raw[1]?.toLowerCase();
  const suitMap = {
    s: { symbol: '&spades;', color: 'black', cls: 'spades' },
    h: { symbol: '&hearts;', color: 'red', cls: 'hearts' },
    d: { symbol: '&diams;', color: 'red', cls: 'diamonds' },
    c: { symbol: '&clubs;', color: 'black', cls: 'clubs' },
  };
  if (!'23456789TJQKA'.includes(rank) || !suitMap[suit]) return { kind: 'text', raw };
  const rankLabel = rank === 'T' ? '10' : rank;
  return {
    kind: 'face',
    raw,
    rank,
    rankLabel,
    suit,
    suitSymbol: suitMap[suit].symbol,
    suitClass: suitMap[suit].cls,
    isRed: suitMap[suit].color === 'red',
  };
}

function cardCodeToAssetPath(cardCode) {
  const parsed = parseCardCode(cardCode);
  if (!parsed) return '';
  if (parsed.kind === 'back') return '/assets/cards/back.svg';
  if (parsed.kind !== 'face') return '';
  const rankMap = {
    A: 'ace',
    K: 'king',
    Q: 'queen',
    J: 'jack',
    T: '10',
    '9': '9',
    '8': '8',
    '7': '7',
    '6': '6',
    '5': '5',
    '4': '4',
    '3': '3',
    '2': '2',
  };
  const suitMap = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
  return `/assets/cards/${rankMap[parsed.rank]}_of_${suitMap[parsed.suit]}.svg`;
}

function cardAriaLabel(cardCode) {
  const parsed = parseCardCode(cardCode);
  if (!parsed) return '空牌位';
  if (parsed.kind === 'back') return '背面牌';
  if (parsed.kind !== 'face') return parsed.raw || '扑克牌';
  const suitNames = { s: '黑桃', h: '红桃', d: '方块', c: '梅花' };
  return `${suitNames[parsed.suit] || ''}${parsed.rankLabel}`;
}

function hashString(input) {
  let hash = 2166136261;
  const text = String(input || '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function avatarSrcForPlayer(player) {
  const pool = player?.isBot ? BOT_AVATAR_ASSETS : AVATAR_ASSETS;
  if (!pool.length) return '';
  return pool[hashString(player?.playerId || player?.name || '') % pool.length];
}

function formatCompactChips(value) {
  const n = Number(value || 0);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}m`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function buildRingLayout(players, selfPlayerId) {
  const ordered = Array.isArray(players) ? [...players] : [];
  const count = Math.max(ordered.length, 1);
  const mobile = window.innerWidth < 960;
  const selfIndex = ordered.findIndex((p) => p.playerId === selfPlayerId);
  const rotation = selfIndex >= 0 ? 90 - (360 / count) * selfIndex : 90;

  const rx = mobile ? (count >= 9 ? 46 : count >= 7 ? 44 : 42) : count >= 9 ? 45 : 43;
  const ry = mobile ? (count >= 9 ? 41 : count >= 7 ? 39 : 36) : count >= 9 ? 39 : 36;

  return ordered.map((player, idx) => {
    const angleDeg = rotation + (360 / count) * idx;
    const rad = (angleDeg * Math.PI) / 180;
    return {
      playerId: player.playerId,
      x: 50 + rx * Math.cos(rad),
      y: 50 + ry * Math.sin(rad),
      angleDeg,
      tier: count >= 9 ? 'dense' : count >= 7 ? 'compact' : 'normal',
    };
  });
}

function cardMarkup(cardCode, className = 'playing-card') {
  const parsed = parseCardCode(cardCode);
  if (!parsed) {
    return `<span class="${className} is-empty" aria-hidden="true"></span>`;
  }
  const src = cardCodeToAssetPath(cardCode);
  if (!src || parsed.kind === 'text') {
    return `<span class="${className} is-text">${escapeHtml(parsed.raw)}</span>`;
  }
  return `
    <span class="${className}${parsed.isRed ? ' is-red' : ''}">
      <img class="poker-card-img" src="${src}" alt="${escapeHtml(cardAriaLabel(cardCode))}" loading="lazy" decoding="async" />
    </span>
  `;
}

function renderCommunityBoard(cards, prevCards = []) {
  const list = Array.isArray(cards) ? cards : [];
  const prevList = Array.isArray(prevCards) ? prevCards : [];
  els.communityBoard.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    const cardCode = list[i] || '';
    const div = document.createElement('div');
    div.className = `board-card${cardCode ? '' : ' empty'}`;
    div.innerHTML = cardCode ? cardMarkup(cardCode, 'playing-card board-playing-card') : '<span class="board-card__placeholder">—</span>';
    if (cardCode && cardCode !== prevList[i] && !isReducedMotionEnabled()) {
      div.classList.add('just-dealt');
    }
    els.communityBoard.appendChild(div);
  }
}

function renderPlayers(state) {
  const ringEl = els.playersRing || els.playersList;
  if (!ringEl) return;
  ringEl.innerHTML = '';
  ringEl.dataset.count = String((state.players || []).length);
  ringEl.classList.toggle('mobile-ring', window.innerWidth < 960);
  if (els.playersList && els.playersList !== ringEl) {
    els.playersList.innerHTML = '';
  }
  const turnSeat = state.hand?.currentTurnSeat;
  const layoutById = new Map(
    buildRingLayout(state.players || [], session.playerId).map((item) => [item.playerId, item])
  );

  for (const player of state.players) {
    const isMe = player.playerId === session.playerId;
    const layout = layoutById.get(player.playerId);
    const classes = [
      'player-card',
      'ring-seat',
      layout?.tier ? `seat-${layout.tier}` : '',
      turnSeat === player.seat ? 'turn' : '',
      player.folded ? 'folded' : '',
      player.isSpectator ? 'spectator' : '',
      !player.connected ? 'offline' : '',
      isMe ? 'me' : '',
    ].filter(Boolean);

    const card = document.createElement('div');
    card.className = classes.join(' ');
    card.dataset.playerId = player.playerId || '';
    card.dataset.seat = String(player.seat);
    if (layout) {
      card.style.left = `${layout.x}%`;
      card.style.top = `${layout.y}%`;
      card.style.setProperty('--seat-angle', `${layout.angleDeg}deg`);
    }

    const badges = [];
    if (player.playerId === state.hostPlayerId) badges.push('<span class="badge host">H</span>');
    if (isMe) badges.push('<span class="badge you">你</span>');
    if (player.isBot) badges.push('<span class="badge bot">Bot</span>');
    if (player.ready) badges.push('<span class="badge ready">R</span>');
    if (player.isSpectator) badges.push('<span class="badge spectator">观</span>');
    if (player.folded) badges.push('<span class="badge folded">F</span>');
    if (player.allIn) badges.push('<span class="badge allin">AI</span>');
    if (!player.connected) badges.push('<span class="badge">离</span>');

    let displayCards = Array.isArray(player.holeCards) ? player.holeCards.slice() : [];
    if (!displayCards.length && state.hand && !player.isSpectator && player.inHand) {
      displayCards = ['??', '??'];
    }

    const cardsHtml = displayCards.map((c) => cardMarkup(c, 'playing-card hand-playing-card')).join('');
    const avatarSrc = avatarSrcForPlayer(player);
    const lastActionText = escapeHtml(player.lastAction || '等待动作');

    card.innerHTML = `
      <div class="ring-seat-shell">
        <div class="ring-seat-top">
          <div class="player-avatar-wrap">
            <img class="player-avatar" src="${avatarSrc}" alt="${escapeHtml(player.isBot ? 'Bot 头像' : '玩家头像')}" loading="lazy" decoding="async" />
            <span class="seat-number">#${player.seat}</span>
          </div>
          <div class="ring-player-meta">
            <div class="ring-player-name" title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</div>
            <div class="ring-player-stack">
              <span class="ring-stack-label">筹码</span>
              <strong data-role="stack">${formatCompactChips(player.stack)}</strong>
            </div>
          </div>
          <div class="badges ring-badges">${badges.join('')}</div>
        </div>
        <div class="cards ring-cards">${cardsHtml}</div>
        <div class="ring-seat-bottom">
          <span class="ring-last-action" title="${lastActionText}">${lastActionText}</span>
          <span class="ring-commitments">轮 ${player.committedRound} · 手 ${player.committedHand}</span>
        </div>
      </div>
    `;

    ringEl.appendChild(card);
  }
}

function setActionButtons(enabledMap) {
  els.checkBtn.disabled = !enabledMap.check;
  els.callBtn.disabled = !enabledMap.call;
  els.foldBtn.disabled = !enabledMap.fold;
  els.allinBtn.disabled = !enabledMap.allin;
  els.raiseBtn.disabled = !enabledMap.raise;
}

function clampRaiseInput(bounds) {
  const min = Number(bounds.minRaiseTo || 0);
  const max = Number(bounds.maxRaiseTo || 0);
  const current = Number(els.raiseToInput.value || 0);
  els.raiseToInput.min = String(min);
  els.raiseToInput.max = String(max);

  if (!Number.isFinite(current) || current <= 0) {
    if (min > 0) els.raiseToInput.value = String(min);
    return;
  }

  if (max > 0 && current > max) {
    els.raiseToInput.value = String(max);
  } else if (min > 0 && current < min) {
    els.raiseToInput.value = String(min);
  }
}

function animateOnce(element, className, duration = 700) {
  if (!element || !className) return;
  if (isReducedMotionEnabled()) return;

  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);

  const existing = activeClassTimers.get(element) || {};
  if (existing[className]) {
    clearTimeout(existing[className]);
  }
  existing[className] = setTimeout(() => {
    element.classList.remove(className);
    const latest = activeClassTimers.get(element);
    if (latest) {
      delete latest[className];
    }
  }, duration);
  activeClassTimers.set(element, existing);
}

function escapeSelectorValue(value) {
  const text = String(value ?? '');
  if (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function') {
    return CSS.escape(text);
  }
  return text.replace(/["\\]/g, '\\$&');
}

function findPlayerCard(playerId) {
  if (!playerId) return null;
  const root = els.playersRing || els.playersList;
  if (!root) return null;
  return root.querySelector(`.player-card[data-player-id="${escapeSelectorValue(playerId)}"]`);
}

function markStackChanges(prevState, state) {
  if (!prevState) return;
  const prevStacks = new Map((prevState.players || []).map((p) => [p.playerId, p.stack]));
  for (const player of state.players || []) {
    if (!prevStacks.has(player.playerId)) continue;
    const oldStack = Number(prevStacks.get(player.playerId));
    const newStack = Number(player.stack);
    if (oldStack === newStack) continue;
    const card = findPlayerCard(player.playerId);
    if (!card) continue;
    animateOnce(card, newStack > oldStack ? 'stack-up' : 'stack-down', 640);
  }
}

function getLatestActionLogLine(state) {
  const lines = state?.hand?.actionLog;
  if (!Array.isArray(lines) || !lines.length) return '';
  return String(lines[lines.length - 1] || '');
}

function classifyLogSound(line) {
  const t = String(line || '').toLowerCase();
  if (!t) return null;
  if (t.includes('all-in') || t.includes('all in') || t.includes('全下')) return 'allin';
  if (t.includes('raise') || t.includes('加注')) return 'raise';
  if (t.includes('call') || t.includes('跟注')) return 'call';
  if (t.includes('check') || t.includes('过牌')) return 'check';
  if (t.includes('fold') || t.includes('弃牌')) return 'fold';
  if (t.includes('blind') || t.includes('盲注')) return 'call';
  if (t.includes('deal') || t.includes('发牌')) return 'deal';
  return null;
}

function handleActionLogFeedback(prevState, state) {
  const prevLines = prevState?.hand?.actionLog || [];
  const nextLines = state?.hand?.actionLog || [];
  if (!Array.isArray(nextLines) || nextLines.length === 0) return;

  if (!prevState) {
    setTableStatusLine(getLatestActionLogLine(state) || `阶段：${phaseLabel(state.phase)}`);
    return;
  }

  if (!Array.isArray(prevLines) || nextLines.length <= prevLines.length) return;

  const newLines = nextLines.slice(prevLines.length);
  const lastLine = newLines[newLines.length - 1];
  setTableStatusLine(lastLine || `阶段：${phaseLabel(state.phase)}`);

  const soundName = classifyLogSound(lastLine);
  if (soundName) playFx(soundName);
}

function updateTableStatusText(state) {
  const sessionMeta = getSessionMeta(state);
  if (sessionMeta.gameOver) {
    const winner = (state.players || []).find((p) => p.playerId === sessionMeta.winnerPlayerId);
    setTableStatusLine(winner ? `整局结束：${winner.name} 获胜` : '整局结束');
    return;
  }
  const me = state.me;
  if (me?.canAct) {
    setTableStatusLine(`轮到你行动 · toCall ${me.toCall}`);
    return;
  }
  const latestLine = getLatestActionLogLine(state);
  if (latestLine) {
    setTableStatusLine(latestLine);
    return;
  }
  if (state.phase === 'LOBBY') {
    setTableStatusLine('等待至少 2 名玩家 Ready');
    return;
  }
  setTableStatusLine(`阶段：${phaseLabel(state.phase)}`);
}

function triggerWinnerEffects(state) {
  const lastResult = state.lastResult;
  if (!lastResult || !lastResult.payouts) return;

  const winnerIds = Object.entries(lastResult.payouts)
    .filter(([, amount]) => Number(amount) > 0)
    .map(([playerId]) => playerId);

  for (const playerId of winnerIds) {
    const card = findPlayerCard(playerId);
    animateOnce(card, 'win-highlight', 960);
  }

  if (winnerIds.includes(session.playerId)) {
    els.resultBox.classList.add('win-self');
    playFx('win');
  } else {
    els.resultBox.classList.remove('win-self');
  }
}

function lastResultKey(state) {
  const r = state?.lastResult;
  if (!r) return '';
  return JSON.stringify({
    message: r.message,
    payouts: r.payouts,
    pots: r.pots,
  });
}

function triggerStateEffects(prevState, state) {
  if (!prevState) {
    updateTableStatusText(state);
    return;
  }

  const prevHand = prevState.hand || null;
  const nextHand = state.hand || null;

  if (prevState.phase !== state.phase) {
    animateOnce(els.tableFelt, 'phase-shift', 700);
    if (['FLOP', 'TURN', 'RIVER'].includes(state.phase)) {
      playFx('deal');
    }
    if (state.phase === 'PREFLOP') {
      playFx('start');
    }
  }

  const prevTurn = prevHand?.currentTurnSeat ?? null;
  const nextTurn = nextHand?.currentTurnSeat ?? null;
  if (prevTurn !== nextTurn && nextTurn != null) {
    animateOnce(els.turnSeatStat, 'flash-bump', 360);
    animateOnce(els.tableFelt, 'pulse-turn', 560);
    if (state.me?.canAct) {
      playFx('turn');
    }
  }

  if ((prevHand?.pot ?? 0) !== (nextHand?.pot ?? 0)) {
    animateOnce(els.potStat, 'flash-bump', 340);
  }
  if ((prevHand?.currentBet ?? 0) !== (nextHand?.currentBet ?? 0)) {
    animateOnce(els.topBetStat, 'flash-bump', 340);
  }

  const prevCommunity = prevHand?.communityCards || [];
  const nextCommunity = nextHand?.communityCards || [];
  if ((nextCommunity.length || 0) > (prevCommunity.length || 0)) {
    for (let i = prevCommunity.length; i < nextCommunity.length; i++) {
      playFx('deal');
    }
  }

  handleActionLogFeedback(prevState, state);
  markStackChanges(prevState, state);

  const prevResult = lastResultKey(prevState);
  const nextResult = lastResultKey(state);
  if (nextResult && nextResult !== prevResult) {
    triggerWinnerEffects(state);
  }

  updateTableStatusText(state);
}

function renderState(state) {
  const prevState = latestState;
  latestState = state;
  session.roomId = state.roomId;
  persistSession();
  updateUrlRoomId(state.roomId);

  els.connectPanel.classList.add('hidden');
  els.roomPanel.classList.remove('hidden');
  els.roomCodeText.textContent = state.roomId;
  els.phaseText.textContent = `阶段：${phaseLabel(state.phase)} (${state.phase})`;
  if (els.sessionText) {
    els.sessionText.textContent = sessionStatusText(state);
  }
  els.roomInput.value = state.roomId;

  const meEntry = currentPlayerEntry();
  const isHost = state.hostPlayerId === session.playerId;
  const hand = state.hand;
  const me = state.me;
  const sessionMeta = getSessionMeta(state);
  const botCount = state.players.filter((p) => p.isBot).length;

  els.startingChipsInput.value = String(state.settings.startingChips || 1000);
  els.startingChipsInput.disabled = !(isHost && state.phase === 'LOBBY');
  els.saveSettingsBtn.disabled = !(isHost && state.phase === 'LOBBY');
  if (els.startGameBtn) {
    setVisible(els.startGameBtn, isHost && sessionMeta.nextAction === 'start-game');
    els.startGameBtn.disabled = !(isHost && state.phase === 'LOBBY' && state.canStart && sessionMeta.nextAction === 'start-game');
  }
  if (els.nextHandBtn) {
    setVisible(els.nextHandBtn, isHost && sessionMeta.nextAction === 'next-hand');
    els.nextHandBtn.disabled = !(isHost && state.phase === 'LOBBY' && state.canStart && sessionMeta.nextAction === 'next-hand' && !sessionMeta.gameOver);
  }
  if (els.resetGameBtn) {
    setVisible(els.resetGameBtn, isHost);
    els.resetGameBtn.disabled = !(isHost && state.phase === 'LOBBY');
  }
  if (els.addBotsBtn) {
    els.addBotsBtn.disabled = !(isHost && state.phase === 'LOBBY' && botCount < 2);
    els.addBotsBtn.textContent = botCount >= 2 ? '已添加 2 个 Bot' : '添加 2 个 Bot';
  }
  els.readyBtn.disabled = !meEntry || state.phase !== 'LOBBY' || meEntry.isSpectator || meEntry.stack <= 0;
  els.readyBtn.textContent = meEntry && meEntry.ready ? '取消 Ready' : 'Ready';

  els.potText.textContent = hand ? String(hand.pot) : '0';
  els.topBetText.textContent = hand ? String(hand.currentBet) : '0';
  els.turnSeatText.textContent = hand && hand.currentTurnSeat != null ? String(hand.currentTurnSeat) : '-';
  els.turnSeatStat.classList.toggle('turn-focus', Boolean(hand && hand.currentTurnSeat != null));

  renderCommunityBoard(hand?.communityCards || [], prevState?.hand?.communityCards || []);
  renderPlayers(state);

  if (me && meEntry) {
    const legal = me.legalActions || {};
    setActionButtons(legal);

    const bounds = me.raise || { minRaiseTo: 0, maxRaiseTo: 0 };
    clampRaiseInput(bounds);

    els.checkBtn.textContent = me.toCall > 0 ? 'Check' : 'Check';
    els.callBtn.textContent = me.toCall > 0 ? `Call ${me.toCall}` : 'Call';
    els.allinBtn.textContent = `All-in${meEntry.stack > 0 ? ` (${meEntry.stack})` : ''}`;

    const myStatusText = [
      `你：#${meEntry.seat} ${meEntry.name}`,
      `筹码 ${meEntry.stack}`,
      `toCall ${me.toCall}`,
      me.canAct ? '轮到你行动' : '等待其他玩家',
      meEntry.isSpectator ? '观战中（可退出房间）' : '',
    ]
      .filter(Boolean)
      .join(' | ');

    els.myStatus.textContent = myStatusText;
    els.myStatus.classList.toggle('my-turn', Boolean(me.canAct));
    els.actionPanel.classList.toggle('my-turn', Boolean(me.canAct));

    const myCard = findPlayerCard(session.playerId);
    if (myCard) {
      myCard.classList.toggle('my-turn', Boolean(me.canAct && !isReducedMotionEnabled()));
    }
  } else {
    setActionButtons({ check: false, call: false, fold: false, allin: false, raise: false });
    els.callBtn.textContent = 'Call';
    els.allinBtn.textContent = 'All-in';
    els.myStatus.textContent = '未找到当前玩家身份，请尝试重连';
    els.myStatus.classList.remove('my-turn');
    els.actionPanel.classList.remove('my-turn');
  }

  const selfWon = Boolean(state.lastResult?.payouts?.[session.playerId] > 0);
  els.resultBox.textContent = formatPayouts(state.lastResult, state.players);
  els.resultBox.classList.toggle('win-self', selfWon);
  if (sessionMeta.gameOver && sessionMeta.winnerPlayerId) {
    const winner = state.players.find((p) => p.playerId === sessionMeta.winnerPlayerId);
    if (winner) {
      const suffix = els.resultBox.textContent ? `\n\n${els.resultBox.textContent}` : '';
      els.resultBox.textContent = `整局结束：${winner.name} 获胜${suffix}`;
    }
  }

  els.actionLog.innerHTML = '';
  for (const line of (hand?.actionLog || []).slice().reverse()) {
    const li = document.createElement('li');
    li.textContent = line;
    els.actionLog.appendChild(li);
  }

  triggerStateEffects(prevState, state);
}

els.createBtn.addEventListener('click', emitCreate);
els.joinBtn.addEventListener('click', emitJoin);
els.rejoinBtn.addEventListener('click', emitRejoin);
if (els.rulesBtn) {
  els.rulesBtn.addEventListener('click', openRulesDialog);
}
if (els.rulesCloseBtn) {
  els.rulesCloseBtn.addEventListener('click', () => closeRulesDialog());
}
if (els.rulesDialog) {
  els.rulesDialog.addEventListener('click', (event) => {
    const rect = els.rulesDialog.getBoundingClientRect();
    const clickedBackdrop =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (clickedBackdrop) {
      closeRulesDialog();
    }
  });
}
els.soundToggleBtn.addEventListener('click', toggleSoundPreference);
els.fxToggleBtn.addEventListener('click', cycleMotionPreference);
els.logToggleBtn.addEventListener('click', () => {
  uiPrefs.logCollapsed = !uiPrefs.logCollapsed;
  persistUiPrefs();
  applyUiPrefs();
});

els.copyLinkBtn.addEventListener('click', async () => {
  if (!session.roomId) return;
  const url = `${window.location.origin}${window.location.pathname}?roomId=${encodeURIComponent(session.roomId)}`;
  try {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      throw new Error('clipboard unsupported');
    }
    await navigator.clipboard.writeText(url);
    toast('邀请链接已复制，可转发到微信');
    playFx('ready');
  } catch (_) {
    toast(`复制失败，请手动复制：${url}`);
  }
});

els.leaveRoomBtn.addEventListener('click', () => {
  if (!session.roomId || !session.playerId) return;
  socket.emit('room:leave', {
    roomId: session.roomId,
    playerId: session.playerId,
  });
});

els.saveSettingsBtn.addEventListener('click', () => {
  if (!latestState) return;
  socket.emit('room:updateSettings', {
    roomId: session.roomId,
    playerId: session.playerId,
    startingChips: Number(els.startingChipsInput.value),
  });
});

els.readyBtn.addEventListener('click', () => {
  const me = currentPlayerEntry();
  if (!me || !latestState) return;
  socket.emit('room:ready', {
    roomId: session.roomId,
    playerId: session.playerId,
    ready: !me.ready,
  });
});

if (els.startGameBtn) {
  els.startGameBtn.addEventListener('click', () => {
    if (!latestState) return;
    socket.emit('room:startGame', {
      roomId: session.roomId,
      playerId: session.playerId,
    });
  });
}

if (els.nextHandBtn) {
  els.nextHandBtn.addEventListener('click', () => {
    if (!latestState) return;
    socket.emit('room:nextHand', {
      roomId: session.roomId,
      playerId: session.playerId,
    });
  });
}

if (els.resetGameBtn) {
  els.resetGameBtn.addEventListener('click', () => {
    if (!latestState) return;
    socket.emit('room:resetGame', {
      roomId: session.roomId,
      playerId: session.playerId,
    });
  });
}

if (els.addBotsBtn) {
  els.addBotsBtn.addEventListener('click', () => {
    if (!latestState) return;
    socket.emit('room:addBots', {
      roomId: session.roomId,
      playerId: session.playerId,
      count: 2,
    });
  });
}

els.checkBtn.addEventListener('click', () => sendAction('check'));
els.callBtn.addEventListener('click', () => sendAction('call'));
els.foldBtn.addEventListener('click', () => sendAction('fold'));
els.allinBtn.addEventListener('click', () => sendAction('allin'));
els.raiseBtn.addEventListener('click', () => {
  const raiseTo = Number(els.raiseToInput.value);
  sendAction('raise', { raiseTo });
});

socket.on('connect', () => {
  setConnStatus(`Socket 已连接 (${socket.id})`);

  const desiredRoomId = (queryRoomId || session.roomId || '').toUpperCase();
  if (desiredRoomId && session.playerId && !hasAutoTriedRejoin) {
    hasAutoTriedRejoin = true;
    socket.emit('room:rejoin', {
      roomId: desiredRoomId,
      playerId: session.playerId,
      name: session.playerName || els.nameInput.value || '',
    });
  } else if (desiredRoomId && !session.playerId) {
    els.roomInput.value = desiredRoomId;
    toast('输入昵称后可直接加入该房间');
  }
});

socket.on('disconnect', () => {
  setConnStatus('Socket 已断开，等待自动重连...');
});

socket.on('room:joined', (payload) => {
  session.roomId = payload.roomId;
  session.playerId = payload.playerId;
  persistSession();
  updateUrlRoomId(payload.roomId);
  setConnStatus(`已进入房间 ${payload.roomId}`);
  toast(payload.rejoined ? '已重连房间' : '进入房间成功');
  playFx('join');
});

socket.on('room:left', () => {
  toast('已退出房间');
  clearRoomSession();
});

socket.on('room:error', (payload) => {
  const message = payload?.message || '发生错误';
  setConnStatus(`错误：${message}`);
  toast(message);
  playFx('error');
});

socket.on('room:botsAdded', (payload) => {
  const count = Number(payload?.addedCount || 0);
  if (count <= 0) {
    toast('未添加机器人');
    return;
  }
  toast(count === 2 ? '已添加 2 个机器人' : `已添加 ${count} 个机器人`);
  playFx('join');
});

socket.on('room:state', (state) => {
  renderState(state);
  const me = currentPlayerEntry();
  if (state.handNumber !== bustToastSeenForHand && me && me.isSpectator && me.stack === 0) {
    bustToastSeenForHand = state.handNumber;
    toast('筹码归零，已自动切换为观战');
    playFx('error');
  }
});

if (motionQuery) {
  const onMotionChange = () => applyUiPrefs();
  if (typeof motionQuery.addEventListener === 'function') {
    motionQuery.addEventListener('change', onMotionChange);
  } else if (typeof motionQuery.addListener === 'function') {
    motionQuery.addListener(onMotionChange);
  }
}

window.addEventListener('resize', () => {
  if (!latestState) return;
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    renderState(latestState);
  });
});

installAudioUnlockListeners();
applyUiPrefs();
renderDisconnectedRoom();
