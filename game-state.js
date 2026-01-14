// game-state.js

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
    trumpRevealCards: [],
    bankerLevel: null,
    scoreLevel: null,
    selectedCards: [],
    pendingRevealKey: null,
    revealCountdown: null,
    revealWindowOpen: false,
    kittyVisible: false,
    phase: "play",
    round: 0,
    invalidActionReason: null,
  };

  let revealCountdownTimer = null;

  function clearRevealCountdown() {
    if (revealCountdownTimer) {
      clearTimeout(revealCountdownTimer);
      revealCountdownTimer = null;
    }
    state.revealCountdown = null;
    Render.renderCountdown(null);
  }

  function startRevealCountdown(onComplete) {
    clearRevealCountdown();
    state.revealCountdown = 5;
    Render.renderCountdown(state.revealCountdown);
    const tick = () => {
      if (state.revealCountdown === null) return;
      if (state.revealCountdown === 0) {
        clearRevealCountdown();
        if (onComplete) onComplete();
        return;
      }
      state.revealCountdown -= 1;
      Render.renderCountdown(state.revealCountdown);
      revealCountdownTimer = setTimeout(tick, 1000);
    };
    revealCountdownTimer = setTimeout(tick, 1000);
  }

  function isHumanBanker() {
    return state.trumpReveal?.player === 0;
  }

  function shouldStartRevealCountdown() {
    return !state.trumpReveal || isHumanBanker();
  }

  function getRevealOptions(phase = state.phase) {
    const isJokerLevel = state.level === "王";
    return {
      requireSameColor: isFirstRound(),
      allowDoubleJokers: phase === "twist" || isJokerLevel
    };
  }

  function beginKittyPhase() {
    if (!state.trumpReveal) return;
    state.phase = "kitty";
    state.revealWindowOpen = false;
    clearRevealCountdown();
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal, {
      revealWindowOpen: state.revealWindowOpen,
      allowPendingReveal: false
    });
    Render.renderKitty(state);
    Render.renderStatus(state);
    Render.animateKittyTransfer(state.trumpReveal.player, () => {
      startTwistPhase();
    });
  }

  function canHumanTwist() {
    const actions = buildTrumpActions();
    return actions.some(action => action.enabled);
  }

  function startTwistPhase() {
    state.phase = "twist";
    if (canHumanTwist()) {
      state.revealWindowOpen = true;
      startRevealCountdown(() => {
        endTwistPhase();
      });
    } else {
      state.revealWindowOpen = false;
      clearRevealCountdown();
      setTimeout(() => {
        endTwistPhase();
      }, 1000);
    }
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal, {
      revealWindowOpen: state.revealWindowOpen,
      allowPendingReveal: false
    });
    Render.renderStatus(state);
  }

  function endTwistPhase() {
    state.revealWindowOpen = false;
    clearRevealCountdown();
    startPlayFromBanker();
  }

  function startPlayFromBanker() {
    state.phase = "play";
    state.turn = state.trumpReveal?.player ?? 0;
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal, {
      revealWindowOpen: false,
      allowPendingReveal: false
    });
    Render.renderReveal(state);
    Render.renderStatus(state);
    if (state.turn !== 0) {
      setTimeout(() => aiTurn(state.turn), 300);
    }
  }

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
    state.trumpRevealCards = [];
    state.pendingRevealKey = null;
    state.revealCountdown = null;
    state.revealWindowOpen = isFirstRound;
    state.kittyVisible = false;
    state.invalidActionReason = null;
    state.bankerTeam = [];
    state.scoreTeam = [];
    state.phase = isFirstRound ? "dealing" : "reveal";

    state.selectedCards = [];
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards, {
      animateDeal: false
    });
    clearRevealCountdown();
    Render.renderKitty(state);
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal, {
      revealWindowOpen: state.revealWindowOpen,
      allowPendingReveal: state.phase === "dealing" && state.revealWindowOpen
    });
    Render.renderStatus(state);
    Render.renderReveal(state);

    const finishDeal = () => {
      const finalizeRevealWindow = () => {
        state.kittyVisible = true;
        Render.renderKitty(state);
        if (!state.trumpSuit) {
          if (isFirstRound) {
            resolveKittyReveal();
          } else {
            autoRevealFromAI();
          }
        }
        state.phase = state.trumpSuit ? "twist" : "reveal";
        tryPendingReveal();
        state.revealWindowOpen = false;
        Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
        Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal, {
          revealWindowOpen: state.revealWindowOpen,
          allowPendingReveal: state.phase === "dealing" && state.revealWindowOpen
        });
        Render.renderStatus(state);
        Render.renderReveal(state);
        if (state.trumpReveal) {
          beginKittyPhase();
        }
      };

      state.phase = state.trumpSuit ? "twist" : "reveal";

      if (shouldStartRevealCountdown()) {
        state.revealWindowOpen = true;
        startRevealCountdown(finalizeRevealWindow);
      } else {
        state.revealWindowOpen = false;
        finalizeRevealWindow();
        return;
      }

      Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
      Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal, {
        revealWindowOpen: state.revealWindowOpen,
        allowPendingReveal: state.phase === "dealing" && state.revealWindowOpen
      });
      Render.renderStatus(state);
      Render.renderReveal(state);
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
          tryPendingReveal();
        }
        Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal, {
          revealWindowOpen: state.revealWindowOpen,
          allowPendingReveal: state.phase === "dealing" && state.revealWindowOpen
        });
        Render.renderStatus(state);
        Render.renderReveal(state);
        attemptAutoRevealDuringDeal(playerIndex);
        dealIndex += 1;
        setTimeout(dealNext, 150);
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
    const allowOverride = true;
    const revealOptions = getRevealOptions();

    state.players.forEach((hand, index) => {
      if (index === 0) return;
      findRevealsForHand(hand, revealOptions).forEach(candidate => {
        if (!candidate.reveal) return;
        if (!aiRevealAllowed(candidate, revealOptions)) return;
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
      applyReveal(best.reveal, best.player, best.cards || []);
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
      const singleReveal = Trump.analyzeReveal([joker], level, {
        requireSameColor,
        allowDoubleJokers
      });
      if (singleReveal) {
        reveals.push({ cards: [joker], reveal: singleReveal });
      }

      Object.keys(levelBySuit).forEach(suit => {
        const levels = levelBySuit[suit];
        if (!levels.length) return;
        if (requireSameColor && !jokerMatchesSuit(joker, suit)) return;
        const singleCards = [joker, levels[0]];
        reveals.push({
          cards: singleCards,
          reveal: Trump.analyzeReveal(singleCards, level, {
            requireSameColor,
            allowDoubleJokers
          })
        });
        if (levels.length >= 2) {
          const doubleCards = [joker, levels[0], levels[1]];
          reveals.push({
            cards: doubleCards,
            reveal: Trump.analyzeReveal(doubleCards, level, {
              requireSameColor,
              allowDoubleJokers
            })
          });
        }
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
    const ok = tryPlay(0, cards, { source: "玩家" });
    if (!ok) return;
    state.selectedCards = [];
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
  }

  function onHumanReveal(key) {
    if (state.phase !== "reveal" && state.phase !== "twist" && state.phase !== "dealing") return;
    if (!state.revealWindowOpen) return;
    let candidate = null;
    if (isFirstRound() && !state.trumpReveal && isSuitKey(key)) {
      candidate = getFirstRoundRevealForSuit(key);
    }
    if (!candidate) {
      candidate = findHumanReveal(key);
    }
    if (!candidate?.reveal) {
      if (state.phase === "dealing" && isFirstRound() && !state.trumpReveal) {
        state.pendingRevealKey = key;
      }
      return;
    }
    const { reveal, cards: revealCards = [] } = candidate;
    if (state.trumpReveal && !Trump.canOverride(reveal, state.trumpReveal.reveal)) {
      return;
    }
    const shouldLockDealing = state.phase === "dealing";
    applyReveal(reveal, 0, revealCards);
    state.pendingRevealKey = null;
    state.phase = shouldLockDealing ? "dealing" : "twist";
    if (!shouldLockDealing) {
      autoRevealFromAI();
    }
    state.selectedCards = [];
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal, {
      revealWindowOpen: state.revealWindowOpen,
      allowPendingReveal: state.phase === "dealing" && state.revealWindowOpen
    });
    Render.renderStatus(state);
    Render.renderReveal(state);
  }

  function buildTrumpActions() {
    const hand = state.players[0] || [];
    const revealOptions = getRevealOptions();
    const candidates = findRevealsForHand(hand, revealOptions).filter(candidate => candidate.reveal);
    const byKey = {
      BJ: [],
      SJ: [],
      "♠": [],
      "♥": [],
      "♣": [],
      "♦": []
    };

    candidates.forEach(candidate => {
      const { reveal } = candidate;
      if (reveal.trumpSuit) {
        if (byKey[reveal.trumpSuit]) {
          byKey[reveal.trumpSuit].push(candidate);
        }
        return;
      }
      if (reveal.type === "DOUBLE_BJ") {
        byKey.BJ.push(candidate);
        return;
      }
      if (reveal.type === "DOUBLE_SJ") {
        byKey.SJ.push(candidate);
        return;
      }
      if (reveal.type === "SINGLE_JOKER") {
        if (reveal.jokerRank === "BJ") {
          byKey.BJ.push(candidate);
        } else if (reveal.jokerRank === "SJ") {
          byKey.SJ.push(candidate);
        }
      }
    });

    const pickCandidate = list => {
      if (!list.length) return null;
      const sorted = list.slice().sort((a, b) => a.reveal.power - b.reveal.power);
      if (!state.trumpReveal) return sorted[0];
      return sorted.find(candidate => Trump.canOverride(candidate.reveal, state.trumpReveal.reveal)) || null;
    };

    return [
      { key: "BJ", label: "♛", color: "red", enabled: Boolean(pickCandidate(byKey.BJ)) },
      { key: "SJ", label: "♚", color: "black", enabled: Boolean(pickCandidate(byKey.SJ)) },
      { key: "♠", label: "♠", color: "black", enabled: Boolean(pickCandidate(byKey["♠"])) },
      { key: "♥", label: "♥", color: "red", enabled: Boolean(pickCandidate(byKey["♥"])) },
      { key: "♣", label: "♣", color: "black", enabled: Boolean(pickCandidate(byKey["♣"])) },
      { key: "♦", label: "♦", color: "red", enabled: Boolean(pickCandidate(byKey["♦"])) }
    ];
  }

  function findHumanReveal(key) {
    const candidates = findRevealsForHand(state.players[0] || [], getRevealOptions())
      .filter(candidate => candidate.reveal);
    const matched = candidates.filter(candidate => {
      const { reveal } = candidate;
      if (key === "BJ") {
        return reveal.type === "DOUBLE_BJ" ||
          (reveal.type === "SINGLE_JOKER" && reveal.jokerRank === "BJ");
      }
      if (key === "SJ") {
        return reveal.type === "DOUBLE_SJ" ||
          (reveal.type === "SINGLE_JOKER" && reveal.jokerRank === "SJ");
      }
      return reveal.trumpSuit === key;
    });

    if (!matched.length && isFirstRound()) {
      return getFirstRoundRevealForSuit(key);
    }

    const sorted = matched.slice().sort((a, b) => a.reveal.power - b.reveal.power);
    if (!state.trumpReveal) return sorted[0] || null;
    return sorted.find(candidate => Trump.canOverride(candidate.reveal, state.trumpReveal.reveal)) || null;
  }

  function applyReveal(reveal, playerIndex, cards = []) {
    state.trumpSuit = reveal.trumpSuit;
    state.trumpReveal = { player: playerIndex, reveal };
    state.trumpRevealCards = cards;
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

  function isSuitKey(key) {
    return key === "♠" || key === "♥" || key === "♣" || key === "♦";
  }

  function attemptAutoRevealDuringDeal(playerIndex) {
    if (!isFirstRound()) return;
    if (state.trumpSuit) return;
    if (playerIndex === 0) return;
    const hand = state.players[playerIndex];
    const revealOptions = getRevealOptions("dealing");
    const reveal = findRevealsForHand(hand, revealOptions)
      .find(candidate => candidate?.reveal && aiRevealAllowed(candidate, revealOptions));
    if (!reveal?.reveal) return;
    applyReveal(reveal.reveal, playerIndex, reveal.cards || []);
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal, {
      revealWindowOpen: state.revealWindowOpen,
      allowPendingReveal: state.phase === "dealing" && state.revealWindowOpen
    });
    Render.renderStatus(state);
    Render.renderReveal(state);
  }

  function resolveKittyReveal() {
    if (state.trumpSuit) return;
    for (const card of state.kitty) {
      const ownerIndex = state.players.findIndex(hand =>
        hand.some(h => h.suit === card.suit && h.rank === card.rank)
      );
      if (ownerIndex >= 0) {
        const trumpSuit = card.suit === "JOKER" ? null : card.suit;
        applyReveal({ trumpSuit, type: "KITTY_MATCH", power: 0 }, ownerIndex, []);
        return;
      }
    }
  }

  function getFirstRoundRevealForSuit(suit) {
    if (!suit || suit === "BJ" || suit === "SJ") return null;
    if (!isFirstRound()) return null;
    const hand = state.players[0] || [];
    const joker = hand.find(card => jokerMatchesSuit(card, suit));
    if (!joker) return null;
    const levels = hand.filter(card => card.rank === state.level && card.suit === suit);
    if (!levels.length) return null;
    const singleCards = [joker, levels[0]];
    const singleReveal = Trump.analyzeReveal(singleCards, state.level, {
      requireSameColor: true,
      allowDoubleJokers: false
    });
    if (singleReveal) {
      return { reveal: singleReveal, cards: singleCards };
    }
    if (levels.length < 2) return null;
    const doubleCards = [joker, levels[0], levels[1]];
    const doubleReveal = Trump.analyzeReveal(doubleCards, state.level, {
      requireSameColor: true,
      allowDoubleJokers: false
    });
    if (!doubleReveal) return null;
    return { reveal: doubleReveal, cards: doubleCards };
  }

  function aiRevealAllowed(candidate, options) {
    if (!candidate?.reveal || !candidate.cards?.length) return false;
    const { requireSameColor } = options;
    const { trumpSuit } = candidate.reveal;
    if (trumpSuit) {
      const joker = candidate.cards.find(card => card.suit === "JOKER");
      if (!joker) return false;
      if (requireSameColor && !jokerMatchesSuit(joker, trumpSuit)) {
        return false;
      }
      return true;
    }
    if (candidate.reveal.type === "SINGLE_JOKER") {
      return true;
    }
    const jokers = candidate.cards.filter(card => card.suit === "JOKER");
    if (jokers.length < 2) return false;
    const allBig = jokers.every(card => isBigJoker(card));
    const allSmall = jokers.every(card => isSmallJoker(card));
    return allBig || allSmall;
  }

  function tryPendingReveal() {
    if (!state.pendingRevealKey) return;
    if (!state.revealWindowOpen) return;
    if (state.trumpReveal || !isFirstRound()) {
      state.pendingRevealKey = null;
      return;
    }
    const candidate = findHumanReveal(state.pendingRevealKey);
    if (!candidate?.reveal) return;
    applyReveal(candidate.reveal, 0, candidate.cards || []);
    state.pendingRevealKey = null;
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal, {
      revealWindowOpen: state.revealWindowOpen,
      allowPendingReveal: state.phase === "dealing" && state.revealWindowOpen
    });
    Render.renderStatus(state);
    Render.renderReveal(state);
  }

  function tryPlay(playerIndex, cards, options = {}) {
    const leadPattern = state.currentTrick[0]?.pattern || null;
    const sourceLabel = options.source || "操作";

    // 跟牌校验
    if (leadPattern) {
      const check = Follow.validateFollowPlay({
        leadPattern,
        followCards: cards,
        handCards: state.players[playerIndex],
        trumpInfo: state
      });
      if (!check.ok) {
        state.invalidActionReason = `${sourceLabel}不合法：${check.reason}`;
        Render.renderRuleMessage(state.invalidActionReason);
        return false;
      }
    }

    state.invalidActionReason = null;
    Render.renderRuleMessage(state.invalidActionReason);
    commitPlay(playerIndex, cards);
    return true;
  }

  function commitPlay(playerIndex, cards) {
    const pattern = Pattern.analyzePlay(cards, state);

    if (state.phase !== "play") {
      state.phase = "play";
      Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal, {
        revealWindowOpen: state.revealWindowOpen,
        allowPendingReveal: state.phase === "dealing" && state.revealWindowOpen
      });
      Render.renderReveal(state);
    }

    state.currentTrick.push({
      player: playerIndex,
      cards,
      pattern
    });

    // 移除手牌
    state.players[playerIndex] =
      state.players[playerIndex].filter(c => !cards.includes(c));

    Render.renderTrick(state.currentTrick, state);

    if (state.currentTrick.length === 4) {
      finishTrick();
      return;
    }

    const next = (playerIndex + 1) % 4;
    setTimeout(() => aiTurn(next), 300);
  }

  function aiTurn(playerIndex) {
    if (playerIndex === 0) {
      return;
    }
    const lead = state.currentTrick[0]?.pattern || null;
    const cards = AI.aiPlay(
      state.players[playerIndex],
      lead,
      state,
      playerIndex
    );
    tryPlay(playerIndex, cards, { source: "AI" });
  }

  function finishTrick() {
    const winner = Compare.compareTrickPlays(
      state.currentTrick,
      state
    );
    const trickCards = state.currentTrick.flatMap(play => play.cards);
    if (state.scoreTeam.includes(winner)) {
      state.score += Score.totalTrickScore(trickCards);
    }

    state.turn = winner;
    state.currentTrick = [];

    state.selectedCards = [];
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal, {
      revealWindowOpen: state.revealWindowOpen,
      allowPendingReveal: state.phase === "dealing" && state.revealWindowOpen
    });
    Render.renderStatus(state);
    if (state.players.every(hand => hand.length === 0)) {
      return;
    }
    if (winner !== 0) {
      setTimeout(() => aiTurn(winner), 300);
    }
  }

  return {
    startGame,
    playSelected: onHumanPlaySelected,
    state
  };

})();
