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
    bankerLevel: null,
    scoreLevel: null,
    selectedCards: [],
    phase: "play",
    round: 0,
  };

  function startGame() {
    const isFirstRound = state.round === 0;
    state.round += 1;
    const deck = Cards.createDeck();
    Cards.shuffle(deck);

    for (let i = 0; i < 100; i++) {
      state.players[i % 4].push(deck.pop());
    }
    state.kitty = deck.slice(); // 8 张底牌
    determineTrump();
    state.bankerLevel = state.level;
    state.scoreLevel = state.level;
    state.phase = state.trumpSuit ? "twist" : "reveal";

    state.selectedCards = [];
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards, {
      animateDeal: isFirstRound
    });
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal);
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

  function onHumanSelect(card) {
    const index = state.selectedCards.indexOf(card);
    if (index >= 0) {
      state.selectedCards.splice(index, 1);
    } else {
      state.selectedCards.push(card);
    }
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
  }

  function onHumanPlaySelected() {
    if (!state.selectedCards.length) return;
    const cards = state.selectedCards.slice();
    const ok = tryPlay(0, cards);
    if (!ok) return;
    state.selectedCards = [];
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
  }

  function onHumanReveal(key) {
    if (state.phase !== "reveal" && state.phase !== "twist") return;
    if (key === "BJ" || key === "SJ") {
      state.trumpSuit = null;
    } else {
      state.trumpSuit = key;
    }
    state.phase = "play";
    state.selectedCards = [];
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal);
    Render.renderStatus(state);
  }

  function buildTrumpActions() {
    const hand = state.players[0] || [];
    const hasBigJoker = hand.filter(card => isBigJoker(card)).length >= 2;
    const hasSmallJoker = hand.filter(card => isSmallJoker(card)).length >= 2;
    const hasAnyJoker = hand.some(card => isBigJoker(card) || isSmallJoker(card));
    const levelCardsBySuit = new Set(
      hand.filter(card => card.rank === state.level).map(card => card.suit)
    );

    const canRevealSuit = suit => hasAnyJoker && levelCardsBySuit.has(suit);

    return [
      { key: "BJ", label: "大王", color: "red", enabled: hasBigJoker },
      { key: "SJ", label: "小王", color: "black", enabled: hasSmallJoker },
      { key: "♠", label: "♠", color: "black", enabled: canRevealSuit("♠") },
      { key: "♥", label: "♥", color: "red", enabled: canRevealSuit("♥") },
      { key: "♣", label: "♣", color: "black", enabled: canRevealSuit("♣") },
      { key: "♦", label: "♦", color: "red", enabled: canRevealSuit("♦") }
    ];
  }

  function isBigJoker(card) {
    return card.suit === "JOKER" && (card.rank === "BJ" || card.rank === "大王");
  }

  function isSmallJoker(card) {
    return card.suit === "JOKER" && (card.rank === "SJ" || card.rank === "小王");
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
        return false;
      }
    }

    commitPlay(playerIndex, cards);
    return true;
  }

  function commitPlay(playerIndex, cards) {
    const pattern = Pattern.analyzePlay(cards, state);

    if (state.phase !== "play") {
      state.phase = "play";
      Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal);
    }

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

    state.selectedCards = [];
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal);
    Render.renderStatus(state);
  }

  return {
    startGame,
    playSelected: onHumanPlaySelected,
    state
  };

})();
