// render.js

window.Render = (function () {

  function renderHand(hand, state, onSelect, selectedCards = [], options = {}) {
    const el = document.getElementById("hand");
    el.innerHTML = "";
    const selectedSet = new Set(selectedCards);
    const { animateDeal = false } = options;
    const dealIndexByCard = new Map();

    if (animateDeal) {
      hand.forEach((card, index) => {
        dealIndexByCard.set(card, index);
      });
    }

    hand
      .slice()
      .sort((a, b) => sortHandCards(a, b, state))
      .forEach(card => {
        const c = createCardElement(card);
        if (animateDeal) {
          c.classList.add("deal");
          const dealIndex = dealIndexByCard.get(card) ?? 0;
          c.style.animationDelay = `${dealIndex * 0.75}s`;
          c.style.animationDuration = "0.75s";
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
    const banker = state.bankerTeam.length
      ? `庄：${state.bankerTeam.includes(0) ? "南北家" : "东西家"}`
      : "庄：未定";
    const mainCard = state.trumpSuit ? `${state.trumpSuit}${state.level}` : `无主${state.level}`;
    const bankerLevel = state.bankerLevel ? state.bankerLevel : state.level;
    const scoreLevel = state.scoreLevel ? state.scoreLevel : state.level;
    document.getElementById("status").innerText =
      `主：${mainCard}\n${banker}\n得分：${state.score}\n南北家等级：${bankerLevel}\n东西家等级：${scoreLevel}`;
  }

  function renderTrumpActions(actions, phase, onReveal) {
    const el = document.getElementById("trump-actions");
    if (!el) return;
    const shouldShow = phase === "reveal" || phase === "twist" || phase === "dealing";
    el.classList.toggle("hidden", !shouldShow);
    el.innerHTML = "";
    if (!shouldShow) return;

    actions.forEach(action => {
      const button = document.createElement("button");
      button.className = "trump-action";
      button.textContent = action.label;
      if (!action.enabled) {
        button.classList.add("disabled");
      } else {
        if (action.color) {
          button.classList.add(action.color);
        }
        button.classList.add("enabled");
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
      const isBigJoker = card.rank === "BJ";
      const rankName = "JOKER";
      return {
        rank: rankName,
        suit: "",
        center: "🤡",
        isRed: isBigJoker
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
