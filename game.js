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

    state.players = [[], [], [], []];
    const dealCards = deck.slice(0, 100);
    state.kitty = deck.slice(100); // 8 张底牌
    state.bankerLevel = state.level;
    state.scoreLevel = state.level;
    state.trumpSuit = null;
    state.trumpReveal = null;
    state.bankerTeam = [];
    state.scoreTeam = [];
    state.phase = isFirstRound ? "dealing" : "reveal";

    state.selectedCards = [];
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards, {
      animateDeal: false
    });
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal);
    Render.renderStatus(state);

    const finishDeal = () => {
      if (!state.trumpSuit) {
        if (isFirstRound) {
          resolveKittyReveal();
        } else {
          autoRevealFromAI();
        }
      }
      state.phase = state.trumpSuit ? "twist" : "reveal";
      Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
      Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal);
      Render.renderStatus(state);
    };

    if (isFirstRound) {
      let dealIndex = 0;
      const dealNext = () => {
        if (dealIndex >= dealCards.length) {
          finishDeal();
          return;
        }
        const playerIndex = dealIndex % 4;
        const card = dealCards[dealIndex];
        state.players[playerIndex].push(card);
        if (playerIndex === 0) {
          Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards, {
            animateDeal: false
          });
        }
        Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal);
        Render.renderStatus(state);
        attemptAutoRevealDuringDeal(playerIndex);
        dealIndex += 1;
        setTimeout(dealNext, 187.5);
      };
      dealNext();
    } else {
      for (let i = 0; i < dealCards.length; i++) {
        state.players[i % 4].push(dealCards[i]);
      }
      finishDeal();
    }
  }

  function autoRevealFromAI() {
    let best = state.trumpReveal;
    const allowOverride = !isFirstRound();

    state.players.forEach((hand, index) => {
      if (index === 0) return;
      findRevealsForHand(hand, {
        requireSameColor: isFirstRound(),
        allowDoubleJokers: !isFirstRound()
      }).forEach(candidate => {
        if (!candidate.reveal) return;
        if (state.trumpReveal && state.trumpReveal.player === index) return;
        if (!best || (allowOverride && Trump.canOverride(candidate.reveal, best.reveal))) {
          best = {
            player: index,
            cards: candidate.cards,
            reveal: candidate.reveal
          };
        }
      });
    });

    if (best && best !== state.trumpReveal) {
      applyReveal(best.reveal, best.player);
      state.phase = "twist";
    }
  }

  function findRevealsForHand(hand, options = {}) {
    const { requireSameColor = false, allowDoubleJokers = true } = options;
    const level = state.level;
    const reveals = [];
    const bigJokers = hand.filter(card => isBigJoker(card));
    const smallJokers = hand.filter(card => isSmallJoker(card));
    const levelBySuit = {};

    hand.forEach(card => {
      if (card.rank !== level) return;
      if (!levelBySuit[card.suit]) {
        levelBySuit[card.suit] = [];
      }
      levelBySuit[card.suit].push(card);
    });

    if (allowDoubleJokers && bigJokers.length >= 2) {
      reveals.push({
        cards: [bigJokers[0], bigJokers[1]],
        reveal: Trump.analyzeReveal([bigJokers[0], bigJokers[1]], level, {
          requireSameColor,
          allowDoubleJokers
        })
      });
    }

    if (allowDoubleJokers && smallJokers.length >= 2) {
      reveals.push({
        cards: [smallJokers[0], smallJokers[1]],
        reveal: Trump.analyzeReveal([smallJokers[0], smallJokers[1]], level, {
          requireSameColor,
          allowDoubleJokers
        })
      });
    }

    const jokers = [...bigJokers, ...smallJokers];
    jokers.forEach(joker => {
      Object.keys(levelBySuit).forEach(suit => {
        const levels = levelBySuit[suit];
        if (!levels.length) return;
        if (requireSameColor && !jokerMatchesSuit(joker, suit)) return;
        const cards = levels.length >= 2
          ? [joker, levels[0], levels[1]]
          : [joker, levels[0]];
        reveals.push({
          cards,
          reveal: Trump.analyzeReveal(cards, level, {
            requireSameColor,
            allowDoubleJokers
          })
        });
      });
    });

    return reveals;
  }

  function onHumanSelect(card) {
    if (state.phase === "dealing") return;
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
    if (state.phase !== "reveal" && state.phase !== "twist" && state.phase !== "dealing") return;
    const reveal = findHumanReveal(key);
    if (!reveal) return;
    if (state.trumpReveal && state.trumpReveal.player === 0) return;
    if (state.trumpReveal && !isFirstRound() && !Trump.canOverride(reveal, state.trumpReveal.reveal)) {
      return;
    }
    if (state.trumpReveal && isFirstRound()) return;
    const shouldLockDealing = state.phase === "dealing";
    applyReveal(reveal, 0);
    state.phase = shouldLockDealing ? "dealing" : "twist";
    if (!shouldLockDealing) {
      autoRevealFromAI();
    }
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
    const hasRedJoker = hand.some(card => isBigJoker(card));
    const hasBlackJoker = hand.some(card => isSmallJoker(card));
    const levelCardsBySuit = new Set(
      hand.filter(card => card.rank === state.level).map(card => card.suit)
    );

    const canRevealSuit = suit => hasAnyJoker && levelCardsBySuit.has(suit);
    const canRevealSuitFirstRound = suit =>
      levelCardsBySuit.has(suit) && (isRedSuit(suit) ? hasRedJoker : hasBlackJoker);

    const isFirst = isFirstRound();
    return [
      { key: "BJ", label: "♛", color: "red", enabled: !isFirst && hasBigJoker },
      { key: "SJ", label: "♚", color: "black", enabled: !isFirst && hasSmallJoker },
      {
        key: "♠",
        label: "♠",
        color: "black",
        enabled: isFirst ? canRevealSuitFirstRound("♠") : canRevealSuit("♠")
      },
      {
        key: "♥",
        label: "♥",
        color: "red",
        enabled: isFirst ? canRevealSuitFirstRound("♥") : canRevealSuit("♥")
      },
      {
        key: "♣",
        label: "♣",
        color: "black",
        enabled: isFirst ? canRevealSuitFirstRound("♣") : canRevealSuit("♣")
      },
      {
        key: "♦",
        label: "♦",
        color: "red",
        enabled: isFirst ? canRevealSuitFirstRound("♦") : canRevealSuit("♦")
      }
    ];
  }

  function findHumanReveal(key) {
    const candidates = findRevealsForHand(state.players[0] || [], {
      requireSameColor: isFirstRound(),
      allowDoubleJokers: !isFirstRound()
    });
    if (isFirstRound()) {
      return candidates.find(c => c.reveal?.trumpSuit === key)?.reveal || null;
    }
    if (key === "BJ") {
      return candidates.find(c => c.reveal?.type === "DOUBLE_BJ")?.reveal || null;
    }
    if (key === "SJ") {
      return candidates.find(c => c.reveal?.type === "DOUBLE_SJ")?.reveal || null;
    }
    return candidates.find(c => c.reveal?.trumpSuit === key)?.reveal || null;
  }

  function applyReveal(reveal, playerIndex) {
    state.trumpSuit = reveal.trumpSuit;
    state.trumpReveal = { player: playerIndex, reveal };
    state.bankerTeam = playerIndex % 2 === 0 ? [0, 2] : [1, 3];
    state.scoreTeam = playerIndex % 2 === 0 ? [1, 3] : [0, 2];
  }

  function isBigJoker(card) {
    return card.suit === "JOKER" && card.rank === "BJ";
  }

  function isSmallJoker(card) {
    return card.suit === "JOKER" && card.rank === "SJ";
  }

  function isFirstRound() {
    return state.round === 1;
  }

  function isRedSuit(suit) {
    return suit === "♥" || suit === "♦";
  }

  function jokerMatchesSuit(joker, suit) {
    return isRedSuit(suit) ? isBigJoker(joker) : isSmallJoker(joker);
  }

  function attemptAutoRevealDuringDeal(playerIndex) {
    if (!isFirstRound()) return;
    if (state.trumpSuit) return;
    if (playerIndex === 0) return;
    const hand = state.players[playerIndex];
    const reveal = findRevealsForHand(hand, {
      requireSameColor: true,
      allowDoubleJokers: false
    })[0];
    if (!reveal?.reveal) return;
    applyReveal(reveal.reveal, playerIndex);
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal);
    Render.renderStatus(state);
  }

  function resolveKittyReveal() {
    if (state.trumpSuit) return;
    for (const card of state.kitty) {
      const ownerIndex = state.players.findIndex(hand =>
        hand.some(h => h.suit === card.suit && h.rank === card.rank)
      );
      if (ownerIndex >= 0) {
        const trumpSuit = card.suit === "JOKER" ? null : card.suit;
        applyReveal({ trumpSuit, type: "KITTY_MATCH", power: 0 }, ownerIndex);
        return;
      }
    }
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
