const { Hand } = require('pokersolver');

function buildSidePots(players) {
  const committedPlayers = (players || [])
    .filter((p) => Number(p.committedHand) > 0)
    .map((p) => ({
      playerId: p.playerId,
      committedHand: Number(p.committedHand),
      folded: Boolean(p.folded),
    }));

  if (committedPlayers.length === 0) {
    return [];
  }

  const caps = [...new Set(committedPlayers.map((p) => p.committedHand))].sort(
    (a, b) => a - b
  );

  const pots = [];
  let previousCap = 0;

  for (const cap of caps) {
    const delta = cap - previousCap;
    if (delta <= 0) {
      previousCap = cap;
      continue;
    }

    const contributors = committedPlayers.filter((p) => p.committedHand >= cap);
    if (contributors.length === 0) {
      previousCap = cap;
      continue;
    }

    const eligiblePlayerIds = contributors
      .filter((p) => !p.folded)
      .map((p) => p.playerId);

    pots.push({
      amount: delta * contributors.length,
      cap,
      eligiblePlayerIds,
    });

    previousCap = cap;
  }

  return pots;
}

function settleShowdown({ communityCards, players }) {
  const pots = buildSidePots(players).map((pot) => ({
    ...pot,
    winnerIds: [],
  }));

  const payouts = {};
  const playerById = new Map(players.map((p) => [p.playerId, p]));

  for (const pot of pots) {
    if (pot.eligiblePlayerIds.length === 0) {
      continue;
    }

    if (pot.eligiblePlayerIds.length === 1) {
      const only = pot.eligiblePlayerIds[0];
      pot.winnerIds = [only];
      payouts[only] = (payouts[only] || 0) + pot.amount;
      continue;
    }

    const solvedHands = pot.eligiblePlayerIds.map((playerId) => {
      const player = playerById.get(playerId);
      const cards = [...player.holeCards, ...communityCards];
      return {
        playerId,
        hand: Hand.solve(cards),
      };
    });

    const winningHands = Hand.winners(solvedHands.map((entry) => entry.hand));
    const winnerIds = solvedHands
      .filter((entry) => winningHands.includes(entry.hand))
      .map((entry) => entry.playerId);

    pot.winnerIds = winnerIds;

    const baseShare = Math.floor(pot.amount / winnerIds.length);
    let remainder = pot.amount % winnerIds.length;

    for (const playerId of winnerIds) {
      payouts[playerId] = (payouts[playerId] || 0) + baseShare;
    }

    // Stable remainder assignment keeps payouts deterministic.
    for (const playerId of winnerIds) {
      if (remainder <= 0) break;
      payouts[playerId] += 1;
      remainder -= 1;
    }
  }

  return { pots, payouts };
}

module.exports = {
  buildSidePots,
  settleShowdown,
};
