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
    lastRoundSummary: null,
    nextBankerIndex: null,
    kittyRevealCard: null,
    kittyOwner: null,
    lastTwistPlayer: null,
    lastTwistReveal: null,
    kittyRevealed: false,
    kittyMultiplier: null,
    awaitingNextRound: false,
    trickHistory: [[], [], [], []],
    trickIndex: 0,
    playedCards: [],
    kittyRevealInProgress: false,
    twistDisabled: false,
  };

  let revealCountdownTimer = null;
  let twistWindowTimers = [];
  const playerLabels = ["南家", "西家", "北家", "东家"];
  const STORAGE_KEY = "doublelevelup-levels";

  function formatCardForLog(card) {
    if (card.suit === "JOKER") {
      return card.rank === "BJ" ? "大王" : "小王";
    }
    return `${card.rank}${card.suit}`;
  }

  function loadSavedLevels() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.snLevel || !parsed.weLevel) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function saveLevels() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        snLevel: state.bankerLevel,
        weLevel: state.scoreLevel,
        nextBankerIndex: state.nextBankerIndex ?? null
      }));
    } catch (error) {
      // ignore storage errors
    }
  }

  function clearRevealCountdown() {
    if (revealCountdownTimer) {
      clearTimeout(revealCountdownTimer);
      revealCountdownTimer = null;
    }
    state.revealCountdown = null;
    Render.renderCountdown(null);
  }

  function startRevealCountdown(onComplete, durationSeconds = 6) {
    clearRevealCountdown();
    state.revealCountdown = durationSeconds;
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
      requireSameColor: true,
      allowDoubleJokers: phase === "twist" || isJokerLevel
    };
  }

  function beginKittyPhase(recipientIndex = (state.trumpReveal?.player ?? 0)) {
    if (!state.trumpReveal) return;
    state.phase = "kitty";
    state.revealWindowOpen = false;
    state.kittyRevealCard = null;
    clearRevealCountdown();
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal, {
      allowPendingReveal: false
    });
    state.kittyOwner = recipientIndex;
    Render.renderKitty(state);
    Render.renderStatus(state);
    Render.renderReveal(state);
    Render.setPlayButtonVisible(recipientIndex === 0);
    Render.setPlayButtonLabel("扣牌");
    Render.animateKittyTransfer(recipientIndex, () => {
      grantKittyToPlayer(recipientIndex);
      if (recipientIndex === 0) {
        state.selectedCards = [];
        Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
        Render.renderRuleMessage(`请选择${state.kitty.length}张扣底`);
        Render.setPlayButtonEnabled(true);
        return;
      }
      autoDiscardKittyForAI(recipientIndex);
      Render.animateKittyReturn(() => {
        proceedAfterKitty();
      });
    }, { keepAtTarget: true });
  }

  function getTwistEligiblePlayers() {
    const excluded = state.kittyOwner;
    return [0, 1, 2, 3].filter(index => index !== excluded);
  }

  function getTwistCandidateForPlayer(playerIndex) {
    const hand = state.players[playerIndex] || [];
    const revealOptions = getRevealOptions("twist");
    const candidates = findRevealsForHand(hand, revealOptions)
      .filter(candidate => candidate.reveal && canTwistByPlayer(playerIndex, candidate.reveal))
      .sort((a, b) => a.reveal.power - b.reveal.power);
    if (!candidates.length) return null;
    if (!state.trumpReveal?.reveal) return candidates[0];
    return candidates.find(candidate =>
      Trump.canOverride(candidate.reveal, state.trumpReveal.reveal)
    ) || null;
  }

  function clearTwistWindowTimers() {
    twistWindowTimers.forEach(timer => clearTimeout(timer));
    twistWindowTimers = [];
  }

  function handleTwistSuccess(playerIndex) {
    clearRevealCountdown();
    clearTwistWindowTimers();
    state.revealWindowOpen = false;
    beginKittyPhase(playerIndex);
  }

  function scheduleAiTwist(twistCandidates) {
    clearTwistWindowTimers();
    twistCandidates.forEach(({ playerIndex }) => {
      const delay = 500 + Math.random() * 4500;
      const timer = setTimeout(() => {
        if (state.phase !== "twist") return;
        if (!state.revealCountdown && state.revealCountdown !== 0) return;
        const candidate = getTwistCandidateForPlayer(playerIndex);
        if (!candidate?.reveal) return;
        if (state.trumpReveal && !Trump.canOverride(candidate.reveal, state.trumpReveal.reveal)) {
          return;
        }
        applyReveal(candidate.reveal, playerIndex, candidate.cards || []);
        handleTwistSuccess(playerIndex);
      }, delay);
      twistWindowTimers.push(timer);
    });
  }

  function startTwistPhase() {
    if (state.twistDisabled) {
      state.revealWindowOpen = false;
      clearRevealCountdown();
      startPlayFromBanker();
      return;
    }
    state.phase = "twist";
    Render.setPlayButtonVisible(false);
    const eligiblePlayers = getTwistEligiblePlayers();
    const twistCandidates = eligiblePlayers
      .map(playerIndex => ({
        playerIndex,
        candidate: getTwistCandidateForPlayer(playerIndex)
      }))
      .filter(entry => entry.candidate);
    const humanCanTwist = twistCandidates.some(entry => entry.playerIndex === 0);

    if (!twistCandidates.length) {
      state.revealWindowOpen = false;
      clearRevealCountdown();
      setTimeout(() => {
        endTwistPhase();
      }, 200);
    } else {
      state.revealWindowOpen = humanCanTwist;
      startRevealCountdown(() => {
        endTwistPhase();
      }, 6);
      scheduleAiTwist(twistCandidates.filter(entry => entry.playerIndex !== 0));
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
    clearTwistWindowTimers();
    startPlayFromBanker();
  }

  function startPlayFromBanker() {
    state.phase = "play";
    state.turn = state.trumpReveal?.player ?? 0;
    Render.setPlayButtonLabel("出牌");
    Render.setPlayButtonVisible(true);
    Render.setPlayButtonEnabled(state.turn === 0);
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal, {
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
    if (isFirstRound) {
      const savedLevels = loadSavedLevels();
      if (savedLevels) {
        state.bankerLevel = savedLevels.snLevel;
        state.scoreLevel = savedLevels.weLevel;
        if (savedLevels.nextBankerIndex !== null && savedLevels.nextBankerIndex !== undefined) {
          state.nextBankerIndex = savedLevels.nextBankerIndex;
        }
        if (state.nextBankerIndex !== null && state.nextBankerIndex !== undefined) {
          state.level = getTeamLevel(getTeamKeyByPlayer(state.nextBankerIndex));
        } else {
          state.level = savedLevels.snLevel;
        }
      } else if (!state.bankerLevel || !state.scoreLevel) {
        state.bankerLevel = state.level;
        state.scoreLevel = state.level;
      }
    }
    const deck = Cards.createDeck();
    Cards.shuffle(deck);

    if (isFirstRound && (!state.bankerLevel || !state.scoreLevel)) {
      state.bankerLevel = state.level;
      state.scoreLevel = state.level;
    }

    state.players = [[], [], [], []];
    const dealCards = deck.slice(0, 100);
    state.kitty = deck.slice(100); // 8 张底牌
    state.trumpSuit = null;
    state.trumpReveal = null;
    state.trumpRevealCards = [];
    state.pendingRevealKey = null;
    state.revealCountdown = null;
    state.revealWindowOpen = false;
    state.kittyVisible = false;
    state.kittyRevealCard = null;
    state.kittyOwner = null;
    state.kittyRevealed = false;
    state.kittyMultiplier = null;
    state.invalidActionReason = null;
    state.bankerTeam = [];
    state.scoreTeam = [];
    state.lastTwistPlayer = null;
    state.lastTwistReveal = null;
    state.awaitingNextRound = false;
    state.trickHistory = [[], [], [], []];
    state.trickIndex = 0;
    state.playedCards = [];
    state.kittyRevealInProgress = false;
    state.twistDisabled = false;
    const hasPresetBanker = state.nextBankerIndex !== null && state.nextBankerIndex !== undefined;
    state.phase = hasPresetBanker ? "reveal" : "dealing";
    state.score = 0;

    if (state.nextBankerIndex !== null && state.nextBankerIndex !== undefined) {
      const bankerIndex = state.nextBankerIndex;
      state.trumpReveal = { player: bankerIndex, reveal: null };
      state.bankerTeam = bankerIndex % 2 === 0 ? [0, 2] : [1, 3];
      state.scoreTeam = bankerIndex % 2 === 0 ? [1, 3] : [0, 2];
    }

    state.selectedCards = [];
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards, {
      animateDeal: false
    });
    Render.setPlayButtonVisible(false);
    Render.setPlayButtonEnabled(false);
    Render.setNextRoundButtonVisible(false);
    Render.bindPileModalHandlers();
    Render.hidePileModal();
    clearRevealCountdown();
    Render.renderKitty(state);
    Render.renderKittyMultiplier(state.kittyMultiplier, false);
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal, {
      allowPendingReveal: state.phase === "dealing" && state.revealWindowOpen
    });
    Render.renderStatus(state);
    Render.renderReveal(state);
    Render.renderTrickPiles(state, onPileClick);

    const finishDeal = () => {
      const finalizeRevealWindow = () => {
        state.kittyVisible = true;
        Render.renderKitty(state);
        if (!state.trumpSuit) {
          autoRevealFromAI();
          if (!state.trumpSuit && resolveKittyReveal()) {
            return;
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

    if (!hasPresetBanker) {
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
          allowPendingReveal: state.phase === "dealing" && state.revealWindowOpen
        });
        Render.renderStatus(state);
        Render.renderReveal(state);
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
        if (!canTwistByPlayer(index, candidate.reveal)) return;
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
    if (state.awaitingNextRound) return;
    const index = state.selectedCards.indexOf(card);
    if (index >= 0) {
      state.selectedCards.splice(index, 1);
    } else {
      state.selectedCards.push(card);
    }
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
  }

  function onPileClick(playerIndex) {
    Render.showPileModal(playerIndex, state);
  }

  function onHumanPlaySelected() {
    if (state.awaitingNextRound) return;
    if (state.phase === "kitty") {
      handleHumanKittyDiscard();
      return;
    }
    if (state.phase !== "play") return;
    if (!state.selectedCards.length) return;
    const cards = state.selectedCards.slice();
    const ok = tryPlay(0, cards, { source: "玩家" });
    if (!ok) return;
    state.selectedCards = [];
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
    if (state.currentTrick.length > 0) {
      Render.setPlayButtonEnabled(false);
    }
  }

  function onHumanReveal(key) {
    if (state.phase !== "reveal" && state.phase !== "twist") return;
    if (!state.revealWindowOpen) return;
    const wasTwistPhase = state.phase === "twist";
    let candidate = null;
    if (isFirstRound() && !state.trumpReveal && isSuitKey(key)) {
      candidate = getFirstRoundRevealForSuit(key);
    }
    if (!candidate) {
      candidate = findHumanReveal(key);
    }
    if (!candidate?.reveal) {
      return;
    }
    const { reveal, cards: revealCards = [] } = candidate;
    if (!canTwistByPlayer(0, reveal)) {
      Render.renderRuleMessage("拧主需间隔其他玩家，除非加强");
      return;
    }
    if (state.trumpReveal && !Trump.canOverride(reveal, state.trumpReveal.reveal)) {
      return;
    }
    applyReveal(reveal, 0, revealCards);
    state.pendingRevealKey = null;
    if (wasTwistPhase) {
      handleTwistSuccess(0);
      return;
    }
    clearRevealCountdown();
    state.revealWindowOpen = false;
    beginKittyPhase(state.trumpReveal?.player ?? 0);
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
      const sorted = list
        .filter(candidate => canTwistByPlayer(0, candidate.reveal))
        .slice()
        .sort((a, b) => b.reveal.power - a.reveal.power);
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
      if (!canTwistByPlayer(0, reveal)) return false;
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

    const sorted = matched.slice().sort((a, b) => b.reveal.power - a.reveal.power);
    if (!state.trumpReveal) return sorted[0] || null;
    return sorted.find(candidate => Trump.canOverride(candidate.reveal, state.trumpReveal.reveal)) || null;
  }

  function applyReveal(reveal, playerIndex, cards = [], options = {}) {
    const overrideBanker = options.overrideBanker ?? false;
    const bankerIndex = overrideBanker ? playerIndex : (state.trumpReveal?.player ?? playerIndex);
    state.trumpSuit = reveal.trumpSuit;
    state.trumpReveal = { player: bankerIndex, reveal };
    state.trumpRevealCards = cards;
    if (reveal?.type === "KITTY_MATCH") {
      state.twistDisabled = true;
    }
    state.bankerTeam = bankerIndex % 2 === 0 ? [0, 2] : [1, 3];
    state.scoreTeam = bankerIndex % 2 === 0 ? [1, 3] : [0, 2];
    state.lastTwistPlayer = playerIndex;
    state.lastTwistReveal = reveal;
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
  }

  function grantKittyToPlayer(playerIndex) {
    if (!state.kitty.length) return;
    state.players[playerIndex] = state.players[playerIndex].concat(state.kitty);
  }

  function autoDiscardKittyForAI(bankerIndex) {
    if (!state.kitty.length) return;
    const sorted = state.players[bankerIndex]
      .slice()
      .sort((a, b) => {
        const powerDiff = Rules.cardPower(a, state) - Rules.cardPower(b, state);
        if (powerDiff !== 0) return powerDiff;
        return Rules.rankValue(a.rank) - Rules.rankValue(b.rank);
      });
    const discard = sorted.slice(0, state.kitty.length);
    state.players[bankerIndex] = state.players[bankerIndex]
      .filter(card => !discard.includes(card));
    state.kitty = discard;
    Render.renderKitty(state);
  }

  function proceedAfterKitty() {
    if (state.twistDisabled) {
      startPlayFromBanker();
      return;
    }
    startTwistPhase();
  }

  function handleHumanKittyDiscard() {
    if (!state.kitty.length) return;
    if (state.selectedCards.length !== state.kitty.length) {
      Render.renderRuleMessage(`请扣${state.kitty.length}张底牌`);
      return;
    }
    const discard = state.selectedCards.slice();
    const ownerIndex = state.kittyOwner ?? 0;
    state.players[ownerIndex] = state.players[ownerIndex].filter(card => !discard.includes(card));
    state.kitty = discard;
    state.selectedCards = [];
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
    Render.renderKitty(state);
    Render.renderRuleMessage(null);
    Render.setPlayButtonEnabled(false);
    Render.animateKittyReturn(() => {
      proceedAfterKitty();
    });
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

  const LEVEL_ORDER = ["2","3","4","5","6","7","8","9","10","J","Q","K","A","王"];

  function advanceLevel(level, steps) {
    const index = LEVEL_ORDER.indexOf(level);
    if (index < 0) return level;
    return LEVEL_ORDER[(index + steps) % LEVEL_ORDER.length];
  }

  function getTeamKeyByPlayer(playerIndex) {
    return playerIndex % 2 === 0 ? "SN" : "WE";
  }

  function getTeamLevel(teamKey) {
    return teamKey === "SN" ? state.bankerLevel : state.scoreLevel;
  }

  function setTeamLevel(teamKey, level) {
    if (teamKey === "SN") {
      state.bankerLevel = level;
      return;
    }
    state.scoreLevel = level;
  }

  function addTeamLevel(teamKey, steps) {
    if (steps <= 0) return;
    const nextLevel = advanceLevel(getTeamLevel(teamKey), steps);
    setTeamLevel(teamKey, nextLevel);
  }

  function summarizeRound(message) {
    state.lastRoundSummary = message;
    Render.renderRuleMessage(message);
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

  function isOneWangUpgrade(prevReveal, nextReveal) {
    if (!prevReveal || !nextReveal) return false;
    if (prevReveal.type !== "ONE_WANG_ONE" || nextReveal.type !== "ONE_WANG_TWO") {
      return false;
    }
    return prevReveal.trumpSuit === nextReveal.trumpSuit;
  }

  function canTwistByPlayer(playerIndex, reveal) {
    if (state.lastTwistPlayer === null || state.lastTwistPlayer === undefined) {
      return true;
    }
    if (state.lastTwistPlayer !== playerIndex) return true;
    return isOneWangUpgrade(state.lastTwistReveal, reveal);
  }

  function resolveKittyReveal() {
    if (state.trumpSuit || state.kittyRevealInProgress) return false;
    state.kittyRevealInProgress = true;
    state.revealWindowOpen = false;
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal, {
      revealWindowOpen: false,
      allowPendingReveal: false
    });
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
    let revealIndex = 0;
    const revealNext = () => {
      if (revealIndex >= state.kitty.length) {
        state.kittyRevealInProgress = false;
        return;
      }
      const card = state.kitty[revealIndex];
      state.kittyRevealCard = card;
      Render.renderKitty(state);
      Render.renderStatus(state);
      Render.renderReveal(state);
      Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
      const ownerIndex = state.players.findIndex(hand =>
        hand.some(h => h.suit === card.suit && h.rank === card.rank)
      );
      if (ownerIndex >= 0) {
        Render.renderKittyOwnerProof(ownerIndex, card);
        setTimeout(() => {
          const trumpSuit = card.suit === "JOKER" ? null : card.suit;
          applyReveal({ trumpSuit, type: "KITTY_MATCH", power: 0 }, ownerIndex, [], {
            overrideBanker: true
          });
          state.kittyRevealCard = null;
          state.kittyRevealInProgress = false;
          Render.renderKitty(state);
          Render.renderStatus(state);
          Render.renderReveal(state);
          beginKittyPhase(ownerIndex);
        }, 1200);
        return;
      }
      revealIndex += 1;
      setTimeout(revealNext, 900);
    };
    revealNext();
    return true;
  }

  function getFirstRoundRevealForSuit(suit) {
    if (!suit || suit === "BJ" || suit === "SJ") return null;
    if (!isFirstRound()) return null;
    const hand = state.players[0] || [];
    const joker = hand.find(card => jokerMatchesSuit(card, suit));
    if (!joker) return null;
    const levels = hand.filter(card => card.rank === state.level && card.suit === suit);
    if (!levels.length) return null;
    if (levels.length >= 2) {
      const doubleCards = [joker, levels[0], levels[1]];
      const doubleReveal = Trump.analyzeReveal(doubleCards, state.level, {
        requireSameColor: true,
        allowDoubleJokers: false
      });
      if (doubleReveal) {
        return { reveal: doubleReveal, cards: doubleCards };
      }
    }
    const singleCards = [joker, levels[0]];
    const singleReveal = Trump.analyzeReveal(singleCards, state.level, {
      requireSameColor: true,
      allowDoubleJokers: false
    });
    if (!singleReveal) return null;
    return { reveal: singleReveal, cards: singleCards };
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
    const playPattern = Pattern.analyzePlay(cards, state);

    if (!leadPattern && playPattern.type === "throw" && playPattern.isTrump) {
      state.invalidActionReason = `${sourceLabel}不合法：主牌禁止甩牌`;
      Render.renderRuleMessage(state.invalidActionReason);
      return false;
    }

    // 首家禁止混合花色出牌
    if (!leadPattern && playPattern.isMixedSuit) {
      state.invalidActionReason = `${sourceLabel}不合法：首家不能出混合花色`;
      Render.renderRuleMessage(state.invalidActionReason);
      return false;
    }

    // 首家甩牌最大性校验
    if (!leadPattern && playPattern.type === "throw") {
      const otherHands = state.players.filter((_, index) => index !== playerIndex);
      const check = Throw.checkThrowMaximality(cards, otherHands, state);
      if (!check.ok) {
        const forcedComponent = Throw.getSmallestThrowComponent(cards, state);
        if (forcedComponent?.cards?.length) {
          state.invalidActionReason = `${sourceLabel}不合法：${check.reason}，已强制出小牌`;
          Render.renderRuleMessage(state.invalidActionReason);
          state.selectedCards = [];
          Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
          commitPlay(playerIndex, forcedComponent.cards);
          return true;
        }
        state.invalidActionReason = `${sourceLabel}不合法：${check.reason}`;
        Render.renderRuleMessage(state.invalidActionReason);
        return false;
      }
    }

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

    Render.renderTrick(state.currentTrick, state, { animatePlayer: playerIndex });

    if (state.currentTrick.length === 4) {
      setTimeout(() => finishTrick(), 1000);
      return;
    }

    const next = (playerIndex + 1) % 4;
    if (next === 0) {
      Render.setPlayButtonEnabled(true);
    }
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
    const ok = tryPlay(playerIndex, cards, { source: "AI" });
    if (!ok && lead) {
      const fallback = AI.findLegalFollow(state.players[playerIndex], lead, state);
      if (fallback?.length) {
        tryPlay(playerIndex, fallback, { source: "AI" });
      }
    }
  }

  function finishTrick() {
    const trickLog = state.currentTrick.map(play => ({
      player: play.player,
      label: playerLabels[play.player] || `玩家${play.player}`,
      cards: play.cards.map(formatCardForLog)
    }));
    console.log("本回合出牌", trickLog);
    const winner = Compare.compareTrickPlays(
      state.currentTrick,
      state
    );
    const winningPlay = state.currentTrick.find(play => play.player === winner);
    const winningPattern = winningPlay
      ? { ...winningPlay.pattern, cards: winningPlay.cards }
      : null;
    const trickCards = state.currentTrick.flatMap(play => play.cards);
    if (state.scoreTeam.includes(winner)) {
      state.score += Score.totalTrickScore(trickCards);
    }
    state.playedCards = state.playedCards.concat(trickCards);

    const nextTrickIndex = state.trickIndex + 1;
    state.currentTrick.forEach(play => {
      state.trickHistory[play.player].push({
        trickIndex: nextTrickIndex,
        cards: play.cards.slice(),
        isMax: play.player === winner
      });
    });
    state.trickIndex = nextTrickIndex;
    Render.renderTrickPiles(state, onPileClick);

    const isLastTrick = state.players.every(hand => hand.length === 0);

    state.turn = winner;
    state.currentTrick = [];

    state.selectedCards = [];
    Render.renderHand(state.players[0], state, onHumanSelect, state.selectedCards);
    Render.renderTrick(state.currentTrick, state);
    Render.renderTrumpActions(buildTrumpActions(), state.phase, onHumanReveal, {
      allowPendingReveal: state.phase === "dealing" && state.revealWindowOpen
    });
    Render.renderStatus(state);
    Render.setPlayButtonEnabled(winner === 0);
    Render.setPlayButtonVisible(true);
    if (isLastTrick) {
      settleRound({ winner, winningPattern });
      return;
    }
    if (winner !== 0) {
      setTimeout(() => aiTurn(winner), 1000);
    }
  }

  function settleRound({ winner, winningPattern }) {
    const lastTrickWinnerIsScorer = state.scoreTeam.includes(winner);
    const bottomMultiplier = lastTrickWinnerIsScorer
      ? Bottom.calcMultiplierByWinningPlay(
          winningPattern || { type: "single", length: 1, cards: [] },
          state.level
        )
      : 0;
    console.log("回合结束信息", {
      lastTrickWinner: playerLabels[winner] || `玩家${winner}`,
      bottomCards: state.kitty.map(formatCardForLog),
      isKouDi: lastTrickWinnerIsScorer,
      bottomMultiplier
    });
    const bottomScore = Bottom.settleBottom({
      bottomCards: state.kitty,
      lastTrickWinnerIsScorer,
      winningPattern: winningPattern || { type: "single", length: 1, cards: [] },
      level: state.level
    });
    if (bottomScore) {
      state.score += bottomScore;
    }

    const bankerIndex = state.trumpReveal?.player ?? 0;
    const bankerTeamKey = getTeamKeyByPlayer(bankerIndex);
    const scorerTeamKey = bankerTeamKey === "SN" ? "WE" : "SN";
    const roundScore = state.score;

    let bankerLevelUp = 0;
    let scorerLevelUp = 0;
    const bankerWon = roundScore < 80;
    let nextBankerIndex = bankerWon ? (bankerIndex + 2) % 4 : (bankerIndex + 1) % 4;
    let roundOutcome = bankerWon ? "庄家队胜，转由队友坐庄" : "庄家队负，右手玩家坐庄";

    if (roundScore === 0) {
      bankerLevelUp = 4;
      roundOutcome = "庄家连升4级";
    } else if (roundScore < 40) {
      bankerLevelUp = 2;
      roundOutcome = "庄家连升2级";
    } else if (roundScore < 80) {
      bankerLevelUp = 1;
      roundOutcome = "庄家升1级";
    } else if (roundScore < 120) {
      roundOutcome = "轮换庄家";
    } else {
      scorerLevelUp = Math.floor((roundScore - 120) / 40) + 1;
      roundOutcome = `闲家升${scorerLevelUp}级`;
    }

    addTeamLevel(bankerTeamKey, bankerLevelUp);
    addTeamLevel(scorerTeamKey, scorerLevelUp);

    state.level = getTeamLevel(getTeamKeyByPlayer(nextBankerIndex));
    state.nextBankerIndex = nextBankerIndex;
    state.score = 0;
    state.currentTrick = [];
    state.phase = "settle";
    state.kittyRevealed = true;
    state.kittyMultiplier = lastTrickWinnerIsScorer ? bottomMultiplier : 0;
    state.kittyVisible = true;
    Render.setPlayButtonEnabled(false);
    Render.renderStatus(state);
    Render.renderKitty(state);
    Render.renderKittyMultiplier(state.kittyMultiplier, true);
    Render.renderTrickPiles(state, onPileClick);

    const summaryParts = [
      `抠底加分：${bottomScore}`,
      `本局得分：${roundScore}`,
      roundOutcome
    ];
    summarizeRound(summaryParts.join("，"));
    saveLevels();

    state.trumpReveal = { player: nextBankerIndex, reveal: null };
    state.trumpSuit = null;
    state.trumpRevealCards = [];
    state.awaitingNextRound = true;
    Render.setNextRoundButtonVisible(true);
  }

  function startNextRound() {
    if (!state.awaitingNextRound) return;
    state.awaitingNextRound = false;
    state.lastRoundSummary = null;
    Render.renderKittyMultiplier(state.kittyMultiplier, false);
    Render.renderRuleMessage("下一局开始");
    startGame();
  }

  return {
    startGame,
    startNextRound,
    playSelected: onHumanPlaySelected,
    state
  };

})();
