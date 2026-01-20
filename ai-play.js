// ai-play.js

window.AI = (function () {

  /**
   * hand: Array<Card>
   * leadPattern: analyzePlay(...) | null
   * state: { level, trumpSuit }
   * role: "leader" | "follower"（暂不深度使用）
   */
  function aiPlay(hand, leadPattern, state, playerIndex) {
    const analyzed = hand.map(card => ({
      card,
      pattern: Pattern.analyzePlay([card], state),
      isTrump: Rules.isTrump(card, state),
      power: Rules.cardPower(card, state)
    }));

    analyzed.sort(compareCardAsc);

    if (!leadPattern) {
      const leadPlay = pickLeadPlay(hand, analyzed, state, playerIndex);
      const leadPatternCheck = Pattern.analyzePlay(leadPlay, state);
      if (leadPatternCheck.type === "throw" && leadPatternCheck.isTrump) {
        return pickNonTrumpSingle(analyzed);
      }
      return leadPlay;
    }

    return pickFollowPlay(hand, analyzed, leadPattern, state, playerIndex);
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

  function pickLeadPlay(hand, analyzed, state, playerIndex) {
    const isBanker = state.bankerTeam?.includes(playerIndex);
    if (isBanker) {
      const preferredRank = state.level === "A" ? "K" : "A";
      const sideHighSingles = hand
        .filter(card => !Rules.isTrump(card, state) && card.rank === preferredRank)
        .map(card => [card])
        .sort((a, b) => Rules.cardPower(a[0], state) - Rules.cardPower(b[0], state));
      if (sideHighSingles.length) {
        return sideHighSingles[0];
      }

      const sideCards = hand.filter(card => !Rules.isTrump(card, state));
      const sideTractors = findLeadTractors(sideCards, state);
      if (sideTractors.length) {
        return pickSafestCandidate(sideTractors, state, hand);
      }

      const sidePairs = findLeadPairs(sideCards, state);
      if (sidePairs.length) {
        const safePairs = sidePairs.filter(pair =>
          !likelyBeaten(pair, Pattern.analyzePlay(pair, state), state, hand)
        );
        return pickSafestCandidate(safePairs.length ? safePairs : sidePairs, state, hand);
      }

      const trumpCards = hand.filter(card => Rules.isTrump(card, state));
      if (trumpCards.length) {
        const trumpTractors = findLeadTractors(trumpCards, state);
        if (trumpTractors.length) {
          return pickSafestCandidate(trumpTractors, state, hand);
        }
        const sortedTrump = trumpCards
          .map(card => ({ card, power: Rules.cardPower(card, state) }))
          .sort((a, b) => a.power - b.power);
        return sortedTrump.length ? [sortedTrump[0].card] : [];
      }
    }

    const endgame = isEndgame(hand);
    const trumpStrength = evaluateTrumpStrength(hand, state);
    const shouldPullTrump = trumpStrength.count >= 6 && trumpStrength.highCount >= 2;

    if (shouldPullTrump && !endgame) {
      const trumpCards = hand.filter(card => Rules.isTrump(card, state));
      const trumpLead = pickPreferredLead(
        findLeadTractors(trumpCards, state),
        findLeadPairs(trumpCards, state),
        trumpCards.map(card => [card]),
        state,
        hand
      );
      if (trumpLead) {
        return trumpLead;
      }
    }

    const shortSuit = pickShortestSideSuit(hand, state);
    if (shortSuit) {
      const suitCards = hand.filter(card =>
        !Rules.isTrump(card, state) && card.suit === shortSuit
      );
      const suitLead = pickPreferredLead(
        findLeadTractors(suitCards, state),
        findLeadPairs(suitCards, state),
        suitCards.map(card => [card]),
        state,
        hand
      );
      if (suitLead) {
        return suitLead;
      }
    }

    const fallbackLead = pickPreferredLead(
      findLeadTractors(hand, state),
      findLeadPairs(hand, state),
      analyzed.map(item => [item.card]),
      state,
      hand
    );
    return fallbackLead || [];
  }

  function pickNonTrumpSingle(analyzed) {
    const nonTrump = analyzed.filter(item => !item.pattern.isTrump).map(item => [item.card]);
    if (nonTrump.length) {
      return nonTrump[0];
    }
    return analyzed.length ? [analyzed[0].card] : [];
  }

  function pickFollowPlay(hand, analyzed, leadPattern, state, playerIndex) {
    const needCount = leadPattern.length;
    const sortedCards = analyzed.map(item => item.card);
    const legalCombos = findLegalCombos(sortedCards, leadPattern, hand, state);

    if (!legalCombos.length) {
      return sortedCards.slice(0, needCount);
    }

    const position = state.currentTrick?.length ?? 1;
    const currentWinner = currentTrickWinner(state);
    const teammateWinning = currentWinner !== null &&
      currentWinner !== playerIndex &&
      isTeammate(playerIndex, currentWinner, state);
    const pointsInTrick = currentTrickPoints(state);
    const endgame = isEndgame(hand);
    const bottomPoints = Score.totalTrickScore(state.kitty || []);
    const isLastTrick = hand.length === leadPattern.length;
    const importantTrick = pointsInTrick >= 10 || endgame || (isLastTrick && bottomPoints > 0);
    const shouldWin = !teammateWinning && importantTrick;

    const matchingType = legalCombos.filter(combo =>
      Pattern.analyzePlay(combo, state).type === leadPattern.type
    );
    const combos = matchingType.length ? matchingType : legalCombos;
    const beaters = combos.filter(combo =>
      beats(Pattern.analyzePlay(combo, state), leadPattern, state)
    );
    const nonBeaters = combos.filter(combo =>
      !beats(Pattern.analyzePlay(combo, state), leadPattern, state)
    );

    if (position === 1) {
      if (beaters.length) {
        if (leadPattern.isTrump) {
          return pickHighestPowerCombo(beaters, state);
        }
        const sameSuitBeaters = beaters.filter(combo => {
          const pattern = Pattern.analyzePlay(combo, state);
          return !pattern.isTrump && pattern.suit === leadPattern.suit;
        });
        if (sameSuitBeaters.length) {
          return pickHighestPowerCombo(sameSuitBeaters, state);
        }
        const trumpPointBeaters = beaters.filter(combo => {
          const pattern = Pattern.analyzePlay(combo, state);
          return pattern.isTrump && combo.some(card => Score.cardScore(card) > 0);
        });
        if (trumpPointBeaters.length) {
          return pickHighestScoreCombo(trumpPointBeaters, state);
        }
        return pickHighestPowerCombo(beaters, state);
      }
      if (nonBeaters.length && isTeammate(playerIndex, (playerIndex + 2) % 4, state)) {
        const pointCombos = combos.filter(combo =>
          combo.some(card => Score.cardScore(card) > 0)
        );
        if (pointCombos.length) {
          return pickHighestScoreCombo(pointCombos, state);
        }
      }
      return pickLowestCostCombo(combos, state);
    }

    if (position === 3) {
      if (teammateWinning) {
        const pointCombos = combos.filter(combo =>
          combo.some(card => Score.cardScore(card) > 0)
        );
        if (pointCombos.length) {
          return pickHighestScoreCombo(pointCombos, state);
        }
        return pickLowestCostCombo(combos, state);
      }
      if (beaters.length) {
        const trumpStrength = evaluateTrumpStrength(hand, state);
        const shouldTryWin = pointsInTrick >= 10 || endgame || trumpStrength.highCount >= 2;
        if (shouldTryWin) {
          return pickLowestCostCombo(beaters, state);
        }
      }
      return pickLowestCostCombo(nonBeaters.length ? nonBeaters : combos, state);
    }

    if (shouldWin && beaters.length) {
      return pickLowestCostCombo(beaters, state);
    }
    if (nonBeaters.length) {
      return pickLowestCostCombo(nonBeaters, state);
    }
    if (beaters.length) {
      return pickLowestCostCombo(beaters, state);
    }
    return pickLowestCostCombo(combos, state);
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
    const groups = groupBySuitAndRank(hand, state);
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

  function pickPreferredLead(tractors, pairs, singles, state, hand) {
    const candidates = [tractors, pairs, singles];
    for (const candidate of candidates) {
      if (candidate.length) {
        return pickSafestCandidate(candidate, state, hand);
      }
    }
    return null;
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

  function pickLowestCostCombo(candidates, state) {
    const scored = candidates.map(cards => {
      const pattern = Pattern.analyzePlay(cards, state);
      const scoreValue = cards.reduce((sum, card) => sum + Score.cardScore(card), 0);
      const power = pattern.power ?? 0;
      const trumpCount = cards.filter(card => Rules.isTrump(card, state)).length;
      return { cards, scoreValue, power, trumpCount };
    });
    scored.sort((a, b) => {
      if (a.scoreValue !== b.scoreValue) return a.scoreValue - b.scoreValue;
      if (a.trumpCount !== b.trumpCount) return a.trumpCount - b.trumpCount;
      return a.power - b.power;
    });
    return scored[0]?.cards || candidates[0];
  }

  function pickHighestPowerCombo(candidates, state) {
    const scored = candidates.map(cards => {
      const pattern = Pattern.analyzePlay(cards, state);
      const power = pattern.power ?? 0;
      return { cards, power };
    });
    scored.sort((a, b) => b.power - a.power);
    return scored[0]?.cards || candidates[0];
  }

  function pickHighestScoreCombo(candidates, state) {
    const scored = candidates.map(cards => {
      const scoreValue = cards.reduce((sum, card) => sum + Score.cardScore(card), 0);
      const power = Pattern.analyzePlay(cards, state).power ?? 0;
      return { cards, scoreValue, power };
    });
    scored.sort((a, b) => {
      if (a.scoreValue !== b.scoreValue) return b.scoreValue - a.scoreValue;
      return b.power - a.power;
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

  function currentTrickWinner(state) {
    if (!state.currentTrick || state.currentTrick.length === 0) return null;
    return Compare.compareTrickPlays(state.currentTrick, state);
  }

  function currentTrickPoints(state) {
    if (!state.currentTrick || state.currentTrick.length === 0) return 0;
    const trickCards = state.currentTrick.flatMap(play => play.cards);
    return Score.totalTrickScore(trickCards);
  }

  function isTeammate(playerIndex, otherIndex, state) {
    if (!state.bankerTeam || !state.scoreTeam) return false;
    return state.bankerTeam.includes(playerIndex) === state.bankerTeam.includes(otherIndex);
  }

  function isEndgame(hand) {
    return hand.length <= 6;
  }

  function evaluateTrumpStrength(hand, state) {
    const trumpCards = hand.filter(card => Rules.isTrump(card, state));
    const highCount = trumpCards.filter(card => Rules.cardPower(card, state) >= 80).length;
    return { count: trumpCards.length, highCount };
  }

  function pickShortestSideSuit(hand, state) {
    const suits = ["♠", "♥", "♣", "♦"];
    const counts = suits.reduce((acc, suit) => {
      acc[suit] = 0;
      return acc;
    }, {});
    hand.forEach(card => {
      if (Rules.isTrump(card, state)) return;
      if (counts[card.suit] !== undefined) {
        counts[card.suit] += 1;
      }
    });
    const sorted = suits
      .filter(suit => counts[suit] > 0)
      .sort((a, b) => counts[a] - counts[b]);
    return sorted[0] || null;
  }

  return {
    aiPlay,
    findLegalFollow
  };

})();
