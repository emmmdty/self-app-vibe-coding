const { HoldemRoom } = require('../../src/engine/holdemRoom');

describe('HoldemRoom bots', () => {
  function createRoom() {
    return new HoldemRoom({
      roomId: 'TEST',
      hostName: 'Host',
      hostSocketId: 's1',
      playerId: 'host',
    });
  }

  test('host can add two bots in lobby and bots are ready', () => {
    const room = createRoom();

    const result = room.addBots('host', 2);

    expect(result.addedCount).toBe(2);
    const bots = room.players.filter((p) => p.isBot);
    expect(bots).toHaveLength(2);
    expect(bots.every((b) => b.ready)).toBe(true);
    expect(bots.every((b) => b.connected)).toBe(true);
    expect(bots.every((b) => b.socketId === null)).toBe(true);
    expect(new Set(bots.map((b) => b.name)).size).toBe(2);
  });

  test('cannot add more than two bots and returns only remaining slots', () => {
    const room = createRoom();

    const first = room.addBots('host', 1);
    const second = room.addBots('host', 2);

    expect(first.addedCount).toBe(1);
    expect(second.addedCount).toBe(1);
    expect(room.players.filter((p) => p.isBot)).toHaveLength(2);
    expect(() => room.addBots('host', 1)).toThrow('机器人已存在');
  });

  test('bot marker is included in room state payload', () => {
    const room = createRoom();
    room.addBots('host', 2);

    const state = room.getStateFor('host');
    const bots = state.players.filter((p) => p.isBot);

    expect(bots).toHaveLength(2);
  });

  test('only host can add bots and only in lobby', () => {
    const room = createRoom();
    room.addOrRejoinPlayer({
      playerId: 'p2',
      name: 'P2',
      socketId: 's2',
    });

    expect(() => room.addBots('p2', 2)).toThrow('只有房主可以执行此操作');

    room.addBots('host', 2);
    room.setReady('host', true);
    room.startHand('host');

    expect(() => room.addBots('host', 1)).toThrow('牌局进行中');
  });
});
