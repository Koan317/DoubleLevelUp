// game.js

window.Game = (function () {
  const state = {
    players: [[], [], [], []],
    currentTrick: [],
    turn: 0,
    level: "2",
    trumpSuit: null,
    score: 0,
    kitty: [],
    bankerTeam: [],
    scoreTeam: [],
    trumpReveal: null,
  };

  function startGame() {
    const deck = Cards.createDeck();
    Cards.shuffle(deck);

    for (let i = 0; i < 100; i++) {
      state.players[i % 4].push(deck.pop());
    }
    state.kitty = deck.slice(); // 8 张底牌
    determineTrump();

    Render.renderHand(state.players[0], onHumanPlay);
    Render.renderStatus(state);
  }

  function determineTrump() {
    const candidates = [];
    state.players.forEach((hand, index) => {
      findRevealsForHand(hand).forEach(candidate => {
        candidates.push({
          player: index,
          cards: candidate.cards,
          reveal: candidate.reveal
        });
      });
    });

    let best = null;
    candidates.forEach(candidate => {
      if (!candidate.reveal) return;
      if (!best || Trump.canOverride(candidate.reveal, best.reveal)) {
        best = candidate;
      }
    });

    if (best) {
      state.trumpSuit = best.reveal.trumpSuit;
      state.trumpReveal = best;
      state.bankerTeam = best.player % 2 === 0 ? [0, 2] : [1, 3];
      state.scoreTeam = best.player % 2 === 0 ? [1, 3] : [0, 2];
    }
  }

  function findRevealsForHand(hand) {
    const level = state.level;
    const reveals = [];
    const bigJokers = hand.filter(card => card.rank === "大王");
    const smallJokers = hand.filter(card => card.rank === "小王");
    const levelBySuit = {};

    hand.forEach(card => {
      if (card.rank !== level) return;
      if (!levelBySuit[card.suit]) {
        levelBySuit[card.suit] = [];
      }
      levelBySuit[card.suit].push(card);
    });

    if (bigJokers.length >= 2) {
      reveals.push({
        cards: [bigJokers[0], bigJokers[1]],
        reveal: Trump.analyzeReveal([bigJokers[0], bigJokers[1]], level)
      });
    }

    if (smallJokers.length >= 2) {
      reveals.push({
        cards: [smallJokers[0], smallJokers[1]],
        reveal: Trump.analyzeReveal([smallJokers[0], smallJokers[1]], level)
      });
    }

    const joker = bigJokers[0] || smallJokers[0];
    if (joker) {
      Object.keys(levelBySuit).forEach(suit => {
        const levels = levelBySuit[suit];
        if (!levels.length) return;
        const cards = levels.length >= 2
          ? [joker, levels[0], levels[1]]
          : [joker, levels[0]];
        reveals.push({
          cards,
          reveal: Trump.analyzeReveal(cards, level)
        });
      });
    }

    return reveals;
  }

  function onHumanPlay(cards) {
    tryPlay(0, cards);
  }

  function tryPlay(playerIndex, cards) {
    const leadPattern = state.currentTrick[0]?.pattern || null;

    // 跟牌校验
    if (leadPattern) {
      const check = Follow.validateFollowPlay({
        leadPattern,
        followCards: cards,
        handCards: state.players[playerIndex],
        trumpInfo: state
      });
      if (!check.ok) {
        alert(check.reason);
        return;
      }
    }

    commitPlay(playerIndex, cards);
  }

  function commitPlay(playerIndex, cards) {
    const pattern = Pattern.analyzePlay(cards, state);

    state.currentTrick.push({
      player: playerIndex,
      cards,
      pattern
    });

    // 移除手牌
    state.players[playerIndex] =
      state.players[playerIndex].filter(c => !cards.includes(c));

    Render.renderTrick(state.currentTrick);

    if (state.currentTrick.length === 4) {
      finishTrick();
      return;
    }

    const next = (playerIndex + 1) % 4;
    setTimeout(() => aiTurn(next), 300);
  }

  function aiTurn(playerIndex) {
    const lead = state.currentTrick[0]?.pattern || null;
    const cards = AI.aiPlay(
      state.players[playerIndex],
      lead,
      state,
      playerIndex
    );
    commitPlay(playerIndex, cards);
  }

  function finishTrick() {
    const winner = Compare.compareTrickPlays(
      state.currentTrick,
      state
    );

    state.turn = winner;
    state.currentTrick = [];

    Render.renderHand(state.players[0], onHumanPlay);
    Render.renderStatus(state);
  }

  return {
    startGame,
    state
  };

})();
