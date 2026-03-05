const { buildSidePots, settleShowdown } = require('../../src/engine/payout');

describe('payout side pots', () => {
  test('builds layered pots from different committed amounts', () => {
    const pots = buildSidePots([
      { playerId: 'p1', committedHand: 100, folded: false },
      { playerId: 'p2', committedHand: 200, folded: false },
      { playerId: 'p3', committedHand: 300, folded: false },
    ]);

    expect(pots).toEqual([
      { amount: 300, cap: 100, eligiblePlayerIds: ['p1', 'p2', 'p3'] },
      { amount: 200, cap: 200, eligiblePlayerIds: ['p2', 'p3'] },
      { amount: 100, cap: 300, eligiblePlayerIds: ['p3'] },
    ]);
  });

  test('settles side pots with independent winners', () => {
    const result = settleShowdown({
      communityCards: ['Ah', 'Kd', '7c', '3s', '2d'],
      players: [
        {
          playerId: 'p1',
          name: 'P1',
          committedHand: 100,
          folded: false,
          holeCards: ['Ac', 'Ad'],
        },
        {
          playerId: 'p2',
          name: 'P2',
          committedHand: 200,
          folded: false,
          holeCards: ['Kh', 'Ks'],
        },
        {
          playerId: 'p3',
          name: 'P3',
          committedHand: 300,
          folded: false,
          holeCards: ['Qh', 'Jh'],
        },
      ],
    });

    expect(result.pots).toHaveLength(3);
    expect(result.payouts).toEqual({ p1: 300, p2: 200, p3: 100 });
    expect(result.pots[0].winnerIds).toEqual(['p1']);
    expect(result.pots[1].winnerIds).toEqual(['p2']);
    expect(result.pots[2].winnerIds).toEqual(['p3']);
  });

  test('excludes folded players from pot eligibility while keeping their chips in the pot', () => {
    const result = settleShowdown({
      communityCards: ['Ah', 'Kd', '7c', '3s', '2d'],
      players: [
        {
          playerId: 'p1',
          name: 'P1',
          committedHand: 100,
          folded: false,
          holeCards: ['Ac', 'Ad'],
        },
        {
          playerId: 'p2',
          name: 'P2',
          committedHand: 100,
          folded: true,
          holeCards: ['Kh', 'Ks'],
        },
        {
          playerId: 'p3',
          name: 'P3',
          committedHand: 100,
          folded: false,
          holeCards: ['Qh', 'Jh'],
        },
      ],
    });

    expect(result.pots).toEqual([
      expect.objectContaining({
        amount: 300,
        eligiblePlayerIds: ['p1', 'p3'],
        winnerIds: ['p1'],
      }),
    ]);
    expect(result.payouts).toEqual({ p1: 300 });
  });
});
