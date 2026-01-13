// render.js

window.Render = (function () {

  function renderHand(hand, state, onSelect, selectedCards = [], options = {}) {
    const el = document.getElementById("hand");
    el.innerHTML = "";
    const selectedSet = new Set(selectedCards);
    const { animateDeal = false } = options;

    hand
      .slice()
      .sort((a, b) => sortHandCards(a, b, state))
      .forEach((card, index) => {
        const c = createCardElement(card);
        if (animateDeal) {
          c.classList.add("deal");
          c.style.animationDelay = `${index * 20}ms`;
        }
        if (selectedSet.has(card)) {
          c.classList.add("selected");
        }
        c.onclick = () => onSelect(card);
        el.appendChild(c);
      });
  }

  function renderTrick(trick) {
    document.querySelectorAll(".played").forEach(e => e.innerHTML = "");

    trick.forEach(t => {
      const area = ["south","west","north","east"][t.player];
      const el = document.querySelector(`.${area}`);

      t.cards.forEach(card => {
        const c = createCardElement(card);
        el.appendChild(c);
      });
    });
  }

  function renderStatus(state) {
    const trumpSuit = state.trumpSuit ? state.trumpSuit : "无花色主";
    const banker = state.bankerTeam.length ? `庄：${state.bankerTeam.join(",")}` : "庄：未定";
    const mainCard = state.trumpSuit ? `${state.trumpSuit}${state.level}` : `无主${state.level}`;
    const bankerLevel = state.bankerLevel ? state.bankerLevel : state.level;
    const scoreLevel = state.scoreLevel ? state.scoreLevel : state.level;
    document.getElementById("status").innerText =
      `主牌：${mainCard}\n主花色：${trumpSuit}\n${banker}\n得分方得分：${state.score}\n庄家等级：${bankerLevel}\n闲家等级：${scoreLevel}`;
  }

  function renderTrumpActions(actions, phase, onReveal) {
    const el = document.getElementById("trump-actions");
    if (!el) return;
    const shouldShow = phase === "reveal" || phase === "twist";
    el.classList.toggle("hidden", !shouldShow);
    el.innerHTML = "";
    if (!shouldShow) return;

    actions.forEach(action => {
      const button = document.createElement("button");
      button.className = `trump-action ${action.color}`.trim();
      button.textContent = action.label;
      if (!action.enabled) {
        button.classList.add("disabled");
      } else {
        button.onclick = () => onReveal(action.key);
      }
      el.appendChild(button);
    });
  }

  function sortHandCards(a, b, state) {
    const suitDiff = suitOrder(a, state) - suitOrder(b, state);
    if (suitDiff !== 0) return suitDiff;
    const powerDiff = Rules.cardPower(b, state) - Rules.cardPower(a, state);
    if (powerDiff !== 0) return powerDiff;
    return Rules.rankValue(b.rank) - Rules.rankValue(a.rank);
  }

  function suitOrder(card, state) {
    if (Rules.isTrump(card, state)) return 0;
    const order = ["♠", "♥", "♣", "♦"];
    const index = order.indexOf(card.suit);
    return index === -1 ? order.length + 1 : index + 1;
  }

  function createCardElement(card) {
    const el = document.createElement("div");
    const display = cardDisplay(card);
    el.className = `card ${display.isRed ? "red" : ""}`.trim();

    const top = document.createElement("div");
    top.className = "corner top";
    top.innerHTML = `<span class="rank">${display.rank}</span><br><span class="suit">${display.suit}</span>`;
    const bottom = document.createElement("div");
    bottom.className = "corner bottom";
    bottom.innerHTML = `<span class="rank">${display.rank}</span><br><span class="suit">${display.suit}</span>`;
    const center = document.createElement("div");
    center.className = "center";
    center.textContent = display.center;

    el.appendChild(top);
    el.appendChild(center);
    el.appendChild(bottom);
    return el;
  }

  function cardDisplay(card) {
    if (card.suit === "JOKER") {
      const rankName = card.rank === "BJ" || card.rank === "大王" ? "大王" : "小王";
      return {
        rank: rankName,
        suit: "",
        center: rankName,
        isRed: true
      };
    }

    const isRed = card.suit === "♥" || card.suit === "♦";
    return {
      rank: card.rank,
      suit: card.suit,
      center: card.suit,
      isRed
    };
  }

  return {
    renderHand,
    renderTrick,
    renderStatus,
    renderTrumpActions
  };

})();
