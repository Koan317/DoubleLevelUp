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
    document.getElementById("status").innerText =
      `主：${state.level}\n得分：${state.score}`;
  }

  return {
    renderHand,
    renderTrick,
    renderStatus
  };

})();
