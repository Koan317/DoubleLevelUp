// ai-play.js

window.AI = (function () {

  /**
   * hand: Array<Card>
   * leadPattern: analyzePlay(...) | null
   * state: { level, trumpSuit }
   * role: "leader" | "follower"（暂不深度使用）
   */
  function aiPlay(hand, leadPattern, state, role) {
    const analyzed = hand.map(card => ({
      card,
      pattern: Pattern.analyzePlay([card], state),
      isTrump: Rules.isTrump(card, state),
      power: Rules.cardPower(card, state)
    }));

    analyzed.sort(compareCardAsc);

    if (!leadPattern) {
      const leadPlay = pickLeadPlay(hand, analyzed, state);
      const leadPatternCheck = Pattern.analyzePlay(leadPlay, state);
      if (leadPatternCheck.type === "throw" && leadPatternCheck.isTrump) {
        return pickNonTrumpSingle(analyzed);
      }
      return leadPlay;
    }

    return pickFollowPlay(hand, analyzed, leadPattern, state);
  }

  /* ================= 工具函数 ================= */

  function compareCardAsc(a, b) {
    // trump > side
    if (a.pattern.isTrump && !b.pattern.isTrump) return 1;
    if (!a.pattern.isTrump && b.pattern.isTrump) return -1;

    return a.power - b.power;
  }

  function beats(myPattern, leadPattern, state) {
    // 主压副
    if (myPattern.isTrump && !leadPattern.isTrump) return true;
    if (!myPattern.isTrump && leadPattern.isTrump) return false;

    if (!myPattern.isTrump && !leadPattern.isTrump) {
      if (myPattern.suit !== leadPattern.suit) {
        return false;
      }
    }

    return myPattern.power > leadPattern.power;
  }

  function pickLeadPlay(hand, analyzed, state) {
    const tractors = findLeadTractors(hand, state);
    if (tractors.length) {
      return pickSafestCandidate(tractors, state, hand);
    }

    const pairs = findLeadPairs(hand, state);
    if (pairs.length) {
      return pickSafestCandidate(pairs, state, hand);
    }

    const singles = analyzed.map(item => [item.card]);
    return pickSafestCandidate(singles, state, hand);
  }

  function pickNonTrumpSingle(analyzed) {
    const nonTrump = analyzed.filter(item => !item.pattern.isTrump).map(item => [item.card]);
    if (nonTrump.length) {
      return nonTrump[0];
    }
    return analyzed.length ? [analyzed[0].card] : [];
  }

  function pickFollowPlay(hand, analyzed, leadPattern, state) {
    const needCount = leadPattern.length;
    const sortedCards = analyzed.map(item => item.card);
    const legalCombos = findLegalCombos(sortedCards, leadPattern, hand, state);

    if (!legalCombos.length) {
      return sortedCards.slice(0, needCount);
    }

    const matchingType = legalCombos.filter(combo =>
      Pattern.analyzePlay(combo, state).type === leadPattern.type
    );
    const combos = matchingType.length ? matchingType : legalCombos;
    const beaters = combos.filter(combo =>
      beats(Pattern.analyzePlay(combo, state), leadPattern, state)
    );
    if (beaters.length) {
      return pickSafestCandidate(beaters, state, hand);
    }
    return pickSafestCandidate(combos, state, hand);
  }

  function findLegalFollow(hand, leadPattern, state) {
    if (!leadPattern) {
      return hand.length ? [hand[0]] : [];
    }
    const sortedCards = hand.slice();
    const legalCombos = findLegalCombos(sortedCards, leadPattern, hand, state);
    if (legalCombos.length) {
      return legalCombos[0];
    }
    return sortedCards.slice(0, leadPattern.length);
  }

  function findLegalCombos(sortedCards, leadPattern, hand, state) {
    const needCount = leadPattern.length;
    const result = [];

    function search(start, combo) {
      if (combo.length === needCount) {
        if (isLegalFollow(combo, leadPattern, hand, state)) {
          result.push(combo.slice());
        }
        return;
      }
      for (let i = start; i <= sortedCards.length - (needCount - combo.length); i++) {
        combo.push(sortedCards[i]);
        search(i + 1, combo);
        combo.pop();
      }
    }

    search(0, []);
    return result;
  }

  function isLegalFollow(cards, leadPattern, hand, state) {
    const check = Follow.validateFollowPlay({
      leadPattern,
      followCards: cards,
      handCards: hand,
      trumpInfo: state
    });
    return check.ok;
  }

  function findLeadPairs(hand, state) {
    const groups = groupBySuitAndRank(hand, state);
    const pairs = [];
    Object.values(groups).forEach(group => {
      if (group.length >= 2) {
        pairs.push([group[0], group[1]]);
      }
    });
    return pairs;
  }

  function findLeadTractors(hand, state) {
    const grouped = groupPairsBySuitType(hand, state);
    const tractors = [];
    grouped.forEach(group => {
      if (group.pairs.length < 2) return;
      const sequences = Tractor.detectTractors(group.pairs, state, {
        suitType: group.suitType
      });
      sequences.forEach(sequence => {
        const cards = [];
        sequence.forEach(pair => {
          const key = `${group.suitType}-${pair.rank}`;
          const pairCards = group.cards[key];
          if (pairCards?.length >= 2) {
            cards.push(pairCards[0], pairCards[1]);
          }
        });
        if (cards.length >= 4) {
          tractors.push(cards);
        }
      });
    });
    return tractors;
  }

  function groupBySuitAndRank(hand, state) {
    const groups = {};
    hand.forEach(card => {
      const suitKey = Rules.isTrump(card, state) ? "trump" : card.suit;
      const key = `${suitKey}-${card.rank}`;
      groups[key] ??= [];
      groups[key].push(card);
    });
    return groups;
  }

  function groupPairsBySuitType(hand, state) {
    const groups = {};
    hand.forEach(card => {
      const suitKey = Rules.isTrump(card, state) ? "trump" : card.suit;
      const key = `${suitKey}-${card.rank}`;
      groups[key] ??= [];
      groups[key].push(card);
    });
    const result = [];
    const mapBySuitType = {};
    Object.keys(groups).forEach(key => {
      const [suitType, rank] = key.split("-");
      if (groups[key].length < 2) return;
      mapBySuitType[suitType] ??= { suitType, pairs: [], cards: {} };
      mapBySuitType[suitType].pairs.push({ rank });
      mapBySuitType[suitType].cards[key] = groups[key];
    });
    Object.values(mapBySuitType).forEach(value => result.push(value));
    return result;
  }

  function pickSafestCandidate(candidates, state, hand) {
    const scored = candidates.map(cards => {
      const pattern = Pattern.analyzePlay(cards, state);
      const scoreValue = cards.reduce((sum, card) => sum + Score.cardScore(card), 0);
      const risk = likelyBeaten(cards, pattern, state, hand) ? 1 : 0;
      const power = pattern.power ?? 0;
      return { cards, risk, scoreValue, power };
    });
    scored.sort((a, b) => {
      if (a.risk !== b.risk) return a.risk - b.risk;
      if (a.scoreValue !== b.scoreValue) return a.scoreValue - b.scoreValue;
      return a.power - b.power;
    });
    return scored[0]?.cards || candidates[0];
  }

  function likelyBeaten(cards, pattern, state, hand) {
    const remaining = remainingCards(state, hand);
    if (!remaining.length) return false;
    const candidatePower = pattern.power ?? 0;
    const isTrump = pattern.suitType === "trump";

    if (!isTrump && remaining.some(card => Rules.isTrump(card, state))) {
      return true;
    }

    if (pattern.type === "single") {
      return remaining.some(card => {
        const p = Pattern.analyzePlay([card], state);
        if (p.suitType !== pattern.suitType) return false;
        if (p.suitType === "side" && p.suit !== pattern.suit) return false;
        return p.power > candidatePower;
      });
    }

    if (pattern.type === "pair") {
      const groups = groupBySuitAndRank(remaining, state);
      return Object.values(groups).some(group => {
        if (group.length < 2) return false;
        const p = Pattern.analyzePlay([group[0]], state);
        if (p.suitType !== pattern.suitType) return false;
        if (p.suitType === "side" && p.suit !== pattern.suit) return false;
        return p.power > candidatePower;
      });
    }

    return remaining.some(card => {
      const p = Pattern.analyzePlay([card], state);
      if (p.suitType !== pattern.suitType) return false;
      if (p.suitType === "side" && p.suit !== pattern.suit) return false;
      return p.power > candidatePower;
    });
  }

  function remainingCards(state, hand) {
    const deck = Cards.createDeck();
    const played = state.playedCards || [];
    const current = state.currentTrick?.flatMap(play => play.cards) || [];
    const seen = new Set([
      ...hand.map(cardKey),
      ...played.map(cardKey),
      ...current.map(cardKey)
    ]);
    return deck.filter(card => !seen.has(cardKey(card)));
  }

  function cardKey(card) {
    return `${card.suit}-${card.rank}`;
  }

  return {
    aiPlay,
    findLegalFollow
  };

})();
