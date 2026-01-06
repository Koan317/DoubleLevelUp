export function renderHand(hand, onPlay) {
  const el = document.getElementById("hand");
  el.innerHTML = "";

  hand.forEach(card => {
    const c = document.createElement("div");
    c.className = "card";
    c.textContent = card.rank + (card.suit !== "JOKER" ? card.suit : "");
    c.onclick = () => onPlay([card]);
    el.appendChild(c);
  });
}

export function renderTrick(trick) {
  document.querySelectorAll(".played").forEach(e => e.innerHTML = "");
  trick.forEach(t => {
    const area = ["south","west","north","east"][t.playerIndex];
    const el = document.querySelector(`.${area}`);
    t.pattern.cards.forEach(card => {
      const c = document.createElement("div");
      c.className = "card";
      c.textContent = card.rank;
      el.appendChild(c);
    });
  });
}

export function renderStatus(state) {
  document.getElementById("status").innerText =
    `主：${state.level}\n得分：${state.score}`;
}
