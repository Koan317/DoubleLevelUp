// render.js

window.Render = (function () {

  function renderHand(hand, onPlay) {
    const el = document.getElementById("hand");
    el.innerHTML = "";

    hand.forEach(card => {
      const c = document.createElement("div");
      c.className = "card";
      c.textContent =
        card.rank + (card.suit !== "JOKER" ? card.suit : "");
      c.onclick = () => onPlay([card]);
      el.appendChild(c);
    });
  }

  function renderTrick(trick) {
    document.querySelectorAll(".played").forEach(e => e.innerHTML = "");

    trick.forEach(t => {
      const area = ["south","west","north","east"][t.player];
      const el = document.querySelector(`.${area}`);

      t.cards.forEach(card => {
        const c = document.createElement("div");
        c.className = "card";
        c.textContent =
          card.rank + (card.suit !== "JOKER" ? card.suit : "");
        el.appendChild(c);
      });
    });
  }

  function renderStatus(state) {
    const trumpSuit = state.trumpSuit ? state.trumpSuit : "无花色主";
    const banker = state.bankerTeam.length ? `庄：${state.bankerTeam.join(",")}` : "庄：未定";
    document.getElementById("status").innerText =
      `主级：${state.level}\n主花色：${trumpSuit}\n${banker}\n得分：${state.score}`;
  }

  return {
    renderHand,
    renderTrick,
    renderStatus
  };

})();
