export function renderHand(hand) {
  const el = document.getElementById("hand");
  el.innerHTML = "";
  hand.forEach(card => {
    const c = document.createElement("div");
    c.className = "card";
    c.textContent = card.rank + card.suit;
    el.appendChild(c);
  });
}

export function renderStatus(state) {
  document.getElementById("status").innerText =
    `主：${state.level}\n得分：${state.score}`;
}
