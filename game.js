import { createDeck, shuffle } from "./cards.js";
import { aiPlay } from "./ai.js";
import { analyzePlay, comparePattern } from "./pattern.js";
import { renderHand, renderTrick, renderStatus } from "./render.js";

export const state = {
  players: [[], [], [], []],
  currentTrick: [],
  turn: 0,
  level: "2",
  trumpSuit: null,
  score: 0
};

export function startGame() {
  const deck = createDeck();
  shuffle(deck);

  for (let i = 0; i < 100; i++) {
    state.players[i % 4].push(deck.pop());
  }
  state.kitty = deck;

  renderHand(state.players[0], onHumanPlay);
  renderStatus(state);
}

function onHumanPlay(cards) {
  playTurn(0, cards);
}

function playTurn(playerIndex, cards) {
  const pattern = analyzePlay(cards, state);
  state.currentTrick.push({ playerIndex, pattern });

  // 移除手牌
  state.players[playerIndex] = state.players[playerIndex].filter(
    c => !cards.includes(c)
  );

  renderTrick(state.currentTrick);

  if (state.currentTrick.length === 4) {
    endTrick();
    return;
  }

  const next = (playerIndex + 1) % 4;
  const lead = state.currentTrick[0].pattern;
  const aiCards = aiPlay(state.players[next], lead, state, next);
  playTurn(next, aiCards);
}

function endTrick() {
  let winner = state.currentTrick[0];
  for (const t of state.currentTrick) {
    if (comparePattern(t.pattern, winner.pattern) > 0) {
      winner = t;
    }
  }

  state.turn = winner.playerIndex;
  state.currentTrick = [];

  renderHand(state.players[0], onHumanPlay);
  renderStatus(state);
}
