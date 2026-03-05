const { HoldemRoom } = require('../../src/engine/holdemRoom');

function createRoom() {
  return new HoldemRoom({
    roomId: 'TEST',
    hostName: 'Host',
    hostSocketId: 's1',
    playerId: 'host',
  });
}

describe('HoldemRoom game session flow', () => {
  test('startGame marks session started and enters a hand', () => {
    const room = createRoom();
    room.addBots('host', 2);
    room.setReady('host', true);

    room.startGame('host');

    expect(room.phase).not.toBe('LOBBY');
    expect(room.hand).not.toBeNull();
    const state = room.getStateFor('host');
    expect(state.session.gameStarted).toBe(true);
    expect(state.session.gameOver).toBe(false);
    expect(state.session.nextAction).toBe('wait');
  });

  test('resetGame keeps players but restores starting chips and lobby state', () => {
    const room = createRoom();
    room.addBots('host', 2);
    room.setReady('host', true);
    room.startGame('host');

    // Force some chip changes.
    room.players[0].stack = 250;
    room.players[1].stack = 1200;
    room.players[2].stack = 550;
    room.phase = 'LOBBY';
    room.hand = null;
    room.lastResult = { message: 'temp' };

    room.resetGame('host');

    expect(room.players).toHaveLength(3);
    expect(room.players.every((p) => p.stack === room.settings.startingChips)).toBe(true);
    expect(room.players.filter((p) => p.isBot).every((p) => p.ready)).toBe(true);
    expect(room.players.filter((p) => !p.isBot).every((p) => !p.ready)).toBe(true);
    const state = room.getStateFor('host');
    expect(state.phase).toBe('LOBBY');
    expect(state.hand).toBeNull();
    expect(state.lastResult).toBeNull();
    expect(state.session.gameStarted).toBe(false);
    expect(state.session.nextAction).toBe('start-game');
  });

  test('startNextHand works after a finished hand when game is not over', () => {
    const room = createRoom();
    room.addBots('host', 2);
    room.setReady('host', true);
    room.startGame('host');

    // Simulate a hand finished and lobby resumed while game still active.
    room.hand = null;
    room.phase = 'LOBBY';
    room.lastResult = { dealerSeat: 0, message: 'done', payouts: {} };
    room.session.gameStarted = true;
    room.session.gameOver = false;
    room.session.handJustEnded = true;
    room.players.forEach((p) => {
      p.ready = true;
      p.isSpectator = false;
      if (p.stack <= 0) p.stack = 1000;
    });

    room.startNextHand('host');

    expect(room.hand).not.toBeNull();
    expect(room.phase).not.toBe('LOBBY');
    expect(room.session.handJustEnded).toBe(false);
  });

  test('gameOver is set when fewer than two active bankroll players remain after cleanup', () => {
    const room = createRoom();
    room.addBots('host', 2);
    room.setReady('host', true);
    room.session.gameStarted = true;
    room.phase = 'HAND_END';
    room.hand = {
      dealerSeat: 0,
      communityCards: [],
    };
    room.lastResult = {
      dealerSeat: 0,
      message: 'done',
      payouts: { host: 15 },
      pots: [],
    };

    room.players.forEach((p, idx) => {
      p.inHand = true;
      p.stack = idx === 0 ? 100 : 0;
      p.ready = true;
      p.isSpectator = false;
    });

    room._endHandCleanup();

    const state = room.getStateFor('host');
    expect(state.session.gameOver).toBe(true);
    expect(state.session.winnerPlayerId).toBe('host');
    expect(state.session.nextAction).toBe('wait');
  });
});
