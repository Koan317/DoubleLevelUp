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
        return pickNonTrumpSingle(analyzed, hand, state);
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
        .filter(card =>
          !Rules.isTrump(card, state) &&
          card.rank === preferredRank &&
          !isCardInPair(card, hand, state)
        )
        .map(card => [card]);
      if (sideHighSingles.length) {
        return pickHighestPowerCombo(sideHighSingles, state);
      }

      const sideCards = hand.filter(card => !Rules.isTrump(card, state));
      const safeSideTractors = pickSafeCandidates(findLeadTractors(sideCards, state), state, hand);
      if (safeSideTractors.length) {
        return pickHighestPowerCombo(safeSideTractors, state);
      }

      const safeSidePairs = pickSafeCandidates(findLeadPairs(sideCards, state), state, hand);
      if (safeSidePairs.length) {
        return pickHighestPowerCombo(safeSidePairs, state);
      }

      const sideLead = pickLeadFrom(sideCards, state, hand);
      if (sideLead) {
        return sideLead;
      }

      const trumpCards = hand.filter(card => Rules.isTrump(card, state));
      if (trumpCards.length) {
        const trumpTractors = findLeadTractors(trumpCards, state);
        if (trumpTractors.length) {
          return pickHighestPowerCombo(trumpTractors, state);
        }
        const trumpLead = pickLeadFrom(trumpCards, state, hand);
        if (trumpLead) {
          return trumpLead;
        }
        return pickLowestPowerSingle(trumpCards, state);
      }
    }

    const sideCards = hand.filter(card => !Rules.isTrump(card, state));
    const safeSideLeads = pickSafeSideLeads(sideCards, state, hand);
    if (sideCards.length && !safeSideLeads.length) {
      const trumpCards = hand.filter(card => Rules.isTrump(card, state));
      if (trumpCards.length) {
        return pickLowestPowerSingle(trumpCards, state);
      }
    }

    const endgame = isEndgame(hand);
    const trumpStrength = evaluateTrumpStrength(hand, state);
    const shouldPullTrump = trumpStrength.count >= 6 && trumpStrength.highCount >= 2;

    if (shouldPullTrump && !endgame) {
      const trumpCards = hand.filter(card => Rules.isTrump(card, state));
      const trumpLead = pickLeadFrom(trumpCards, state, hand);
      if (trumpLead) {
        return trumpLead;
      }
    }

    const shortSuit = pickShortestSideSuit(hand, state);
    if (shortSuit) {
      const suitCards = hand.filter(card =>
        !Rules.isTrump(card, state) && card.suit === shortSuit
      );
      const suitLead = pickLeadFrom(suitCards, state, hand);
      if (suitLead) {
        return suitLead;
      }
    }

    const fallbackLead = pickLeadFrom(analyzed.map(item => item.card), state, hand);
    return fallbackLead || [];
  }

  function pickNonTrumpSingle(analyzed, hand, state) {
    const nonTrump = analyzed
      .filter(item => !item.pattern.isTrump && !isCardInPair(item.card, hand, state))
      .map(item => [item.card]);
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

    if (needsSlough(hand, leadPattern, state)) {
      return pickPreferredSloughCombo(legalCombos, leadPattern, hand, state);
    }

    const position = state.currentTrick?.length ?? 1;
    const leaderPlayer = state.currentTrick?.[0]?.player ?? null;
    const leaderIsTeammate = leaderPlayer !== null && isTeammate(playerIndex, leaderPlayer, state);
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

    const enrichedCombos = enrichCombos(legalCombos, leadPattern, state);
    const matchingType = enrichedCombos.filter(combo => combo.pattern.type === leadPattern.type);
    const combos = matchingType.length ? matchingType : enrichedCombos;
    const beaters = combos.filter(combo => combo.isBeater);
    const nonBeaters = combos.filter(combo => !combo.isBeater);

    if (position === 1) {
      if (leaderIsTeammate) {
        const pointCombos = nonBeaters.filter(combo => combo.hasPoint);
        if (pointCombos.length) {
          return pickHighestScoreComboFromEnriched(pointCombos);
        }
        return pickLowestCostNonPointComboFromEnriched(nonBeaters.length ? nonBeaters : combos);
      }
      if (beaters.length && shouldWin) {
        if (leadPattern.isTrump) {
          return pickLowestCostNonPointComboFromEnriched(beaters);
        }
        const sameSuitBeaters = beaters.filter(combo =>
          !combo.pattern.isTrump && combo.pattern.suit === leadPattern.suit
        );
        if (sameSuitBeaters.length) {
          return pickLowestCostNonPointComboFromEnriched(sameSuitBeaters);
        }
        const trumpPointBeaters = beaters.filter(combo => combo.pattern.isTrump && combo.hasPoint);
        if (trumpPointBeaters.length) {
          return pickHighestScoreComboFromEnriched(trumpPointBeaters);
        }
        return pickLowestCostNonPointComboFromEnriched(beaters);
      }
      return pickLowestCostNonPointComboFromEnriched(nonBeaters.length ? nonBeaters : combos);
    }

    if (position === 2) {
      if (teammateWinning) {
        const pointCombos = nonBeaters.filter(combo => combo.hasPoint);
        if (pointCombos.length) {
          return pickHighestScoreComboFromEnriched(pointCombos);
        }
        return pickLowestCostNonPointComboFromEnriched(nonBeaters.length ? nonBeaters : combos);
      }
      if (beaters.length && shouldWin) {
        return pickLowestCostNonPointComboFromEnriched(beaters);
      }
      return pickLowestCostNonPointComboFromEnriched(nonBeaters.length ? nonBeaters : combos);
    }

    if (position === 3) {
      if (teammateWinning) {
        const pointCombos = combos.filter(combo => combo.hasPoint);
        if (pointCombos.length) {
          return pickHighestScoreComboFromEnriched(pointCombos);
        }
        return pickLowestCostNonPointComboFromEnriched(combos);
      }
      if (beaters.length && shouldWin) {
        const trumpStrength = evaluateTrumpStrength(hand, state);
        const shouldTryWin = pointsInTrick >= 10 || endgame || trumpStrength.highCount >= 2;
        if (shouldTryWin) {
          return pickLowestCostNonPointComboFromEnriched(beaters);
        }
      }
      return pickLowestCostNonPointComboFromEnriched(nonBeaters.length ? nonBeaters : combos);
    }

    if (shouldWin && beaters.length) {
      return pickLowestCostNonPointComboFromEnriched(beaters);
    }
    if (nonBeaters.length) {
      return pickLowestCostNonPointComboFromEnriched(nonBeaters);
    }
    if (beaters.length) {
      return pickLowestCostNonPointComboFromEnriched(beaters);
    }
    return pickLowestCostNonPointComboFromEnriched(combos);
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

  function needsSlough(hand, leadPattern, state) {
    const matchingCount = countMatchingCards(hand, leadPattern, state);
    return matchingCount < leadPattern.length;
  }

  function countMatchingCards(hand, leadPattern, state) {
    return hand.filter(card => isMatchingCard(card, leadPattern, state)).length;
  }

  function isMatchingCard(card, leadPattern, state) {
    if (leadPattern.suitType === "trump") {
      return Rules.isTrump(card, state);
    }
    return !Rules.isTrump(card, state) && card.suit === leadPattern.suit;
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

  function suitKeyForCard(card, state) {
    return Rules.isTrump(card, state) ? "trump" : card.suit;
  }

  function isCardInPair(card, hand, state) {
    const groups = groupBySuitAndRank(hand, state);
    const suitKey = suitKeyForCard(card, state);
    const key = `${suitKey}-${card.rank}`;
    return (groups[key]?.length ?? 0) >= 2;
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

  function pickLeadFrom(cards, state, hand) {
    return pickPreferredLead(
      findLeadTractors(cards, state),
      findLeadPairs(cards, state),
      cards.map(card => [card]),
      state,
      hand
    );
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

  function pickSafeCandidates(candidates, state, hand) {
    return candidates.filter(cards => {
      const pattern = Pattern.analyzePlay(cards, state);
      return !likelyBeaten(cards, pattern, state, hand);
    });
  }

  function pickSafeSideLeads(sideCards, state, hand) {
    const tractors = pickSafeCandidates(findLeadTractors(sideCards, state), state, hand);
    const pairs = pickSafeCandidates(findLeadPairs(sideCards, state), state, hand);
    const singles = pickSafeCandidates(sideCards.map(card => [card]), state, hand);
    return [...tractors, ...pairs, ...singles];
  }

  function enrichCombos(combos, leadPattern, state) {
    return combos.map(cards => {
      const pattern = Pattern.analyzePlay(cards, state);
      const score = cards.reduce((sum, card) => sum + Score.cardScore(card), 0);
      const trumpCount = cards.filter(card => Rules.isTrump(card, state)).length;
      return {
        cards,
        pattern,
        isBeater: beats(pattern, leadPattern, state),
        score,
        power: pattern.power ?? 0,
        isTrump: pattern.isTrump,
        hasPoint: score > 0,
        trumpCount
      };
    });
  }

  function pickBy(candidates, scorer, cmp) {
    const scored = candidates.map(cards => ({ cards, ...scorer(cards) }));
    scored.sort(cmp);
    return scored[0]?.cards || candidates[0] || [];
  }

  function pickHighestPowerCombo(candidates, state) {
    return pickBy(
      candidates,
      cards => ({ power: Pattern.analyzePlay(cards, state).power ?? 0 }),
      (a, b) => b.power - a.power
    );
  }

  function pickLowestPowerSingle(cards, state) {
    if (!cards.length) return [];
    const sorted = cards.slice().sort((a, b) => Rules.cardPower(a, state) - Rules.cardPower(b, state));
    return [sorted[0]];
  }

  function pickByEnriched(candidates, cmp) {
    const sorted = candidates.slice().sort(cmp);
    return sorted[0]?.cards || candidates[0]?.cards || [];
  }

  function pickLowestCostComboFromEnriched(candidates) {
    return pickByEnriched(candidates, (a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.trumpCount !== b.trumpCount) return a.trumpCount - b.trumpCount;
      return a.power - b.power;
    });
  }

  function pickLowestCostNonPointComboFromEnriched(candidates) {
    const nonPoint = candidates.filter(candidate => !candidate.hasPoint);
    return pickLowestCostComboFromEnriched(nonPoint.length ? nonPoint : candidates);
  }

  function pickPreferredSloughCombo(candidates, leadPattern, hand, state) {
    const context = buildSloughContext(hand, state);
    return pickBy(
      candidates,
      combo => scoreSloughCombo(combo, leadPattern, state, context),
      (a, b) => {
        if (a.sloughMaxPower !== b.sloughMaxPower) return a.sloughMaxPower - b.sloughMaxPower;
        if (a.sloughPower !== b.sloughPower) return a.sloughPower - b.sloughPower;
        if (a.tractorBreaks !== b.tractorBreaks) return a.tractorBreaks - b.tractorBreaks;
        if (a.pairBreaks !== b.pairBreaks) return a.pairBreaks - b.pairBreaks;
        if (a.sloughTractorPenalty !== b.sloughTractorPenalty) {
          return a.sloughTractorPenalty - b.sloughTractorPenalty;
        }
        if (a.sloughPairPenalty !== b.sloughPairPenalty) {
          return a.sloughPairPenalty - b.sloughPairPenalty;
        }
        if (a.sloughTrumpCount !== b.sloughTrumpCount) return a.sloughTrumpCount - b.sloughTrumpCount;
        return a.comboPower - b.comboPower;
      }
    );
  }

  function buildSloughContext(hand, state) {
    const groups = groupBySuitAndRank(hand, state);
    const pairKeys = new Set();
    const pairRanksBySuitType = {};

    Object.keys(groups).forEach(key => {
      if (groups[key].length < 2) return;
      pairKeys.add(key);
      const [suitType, rank] = key.split("-");
      pairRanksBySuitType[suitType] ??= [];
      pairRanksBySuitType[suitType].push(rank);
    });

    const tractorRanksBySuitType = {};
    Object.keys(pairRanksBySuitType).forEach(suitType => {
      tractorRanksBySuitType[suitType] = detectTractorRanks(pairRanksBySuitType[suitType], suitType, state);
    });

    return { pairKeys, tractorRanksBySuitType };
  }

  function detectTractorRanks(pairRanks, suitType, state) {
    const tractorRanks = new Set();
    const ranks = Array.from(new Set(pairRanks));
    if (suitType === "trump" && ranks.includes("BJ") && ranks.includes("SJ")) {
      tractorRanks.add("BJ");
      tractorRanks.add("SJ");
    }

    const order = Pattern.getSequenceOrder(state, suitType === "trump" ? "trump" : "side");
    const indices = ranks
      .map(rank => ({ rank, idx: order.indexOf(rank) }))
      .filter(item => item.idx >= 0)
      .sort((a, b) => a.idx - b.idx);

    if (!indices.length) {
      return tractorRanks;
    }

    let sequence = [indices[0]];
    for (let i = 1; i < indices.length; i++) {
      const prev = indices[i - 1];
      const current = indices[i];
      if (current.idx === prev.idx + 1) {
        sequence.push(current);
      } else {
        if (sequence.length >= 2) {
          sequence.forEach(item => tractorRanks.add(item.rank));
        }
        sequence = [current];
      }
    }
    if (sequence.length >= 2) {
      sequence.forEach(item => tractorRanks.add(item.rank));
    }
    return tractorRanks;
  }

  function scoreSloughCombo(combo, leadPattern, state, context) {
    const sloughCards = combo.filter(card => !isMatchingCard(card, leadPattern, state));
    const sloughPowers = sloughCards.map(card => Rules.cardPower(card, state));
    const sloughPower = sloughPowers.reduce((sum, value) => sum + value, 0);
    const sloughMaxPower = sloughPowers.length ? Math.max(...sloughPowers) : 0;
    const sloughTrumpCount = sloughCards.filter(card => Rules.isTrump(card, state)).length;
    const comboPower = combo.reduce((sum, card) => sum + Rules.cardPower(card, state), 0);

    const pairBreaks = sloughCards.filter(card => {
      const key = `${suitKeyForCard(card, state)}-${card.rank}`;
      return context.pairKeys.has(key);
    }).length;

    const tractorBreaks = sloughCards.filter(card => {
      const suitKey = suitKeyForCard(card, state);
      return context.tractorRanksBySuitType[suitKey]?.has(card.rank);
    }).length;

    const sloughPairPenalty = sloughHasPair(sloughCards, state) ? 1 : 0;
    const sloughTractorPenalty = sloughHasTractor(sloughCards, state) ? 1 : 0;

    return {
      sloughPower,
      sloughMaxPower,
      sloughTrumpCount,
      comboPower,
      pairBreaks,
      tractorBreaks,
      sloughPairPenalty,
      sloughTractorPenalty
    };
  }

  function sloughHasPair(cards, state) {
    const groups = groupBySuitAndRank(cards, state);
    return Object.values(groups).some(group => group.length >= 2);
  }

  function sloughHasTractor(cards, state) {
    const groups = groupBySuitAndRank(cards, state);
    const pairRanksBySuitType = {};
    Object.keys(groups).forEach(key => {
      if (groups[key].length < 2) return;
      const [suitType, rank] = key.split("-");
      pairRanksBySuitType[suitType] ??= [];
      pairRanksBySuitType[suitType].push(rank);
    });

    return Object.keys(pairRanksBySuitType).some(suitType => {
      const tractorRanks = detectTractorRanks(pairRanksBySuitType[suitType], suitType, state);
      return tractorRanks.size >= 2;
    });
  }

  function pickHighestScoreComboFromEnriched(candidates) {
    return pickByEnriched(candidates, (a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return b.power - a.power;
    });
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
