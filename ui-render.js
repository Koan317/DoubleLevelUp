// ui-render.js

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
          c.style.animationDelay = `${dealIndex * 0.6}s`;
          c.style.animationDuration = "0.6s";
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
    const playerLabels = ["南家", "西家", "北家", "东家"];
    const banker = state.trumpReveal
      ? `庄：${playerLabels[state.trumpReveal.player] || "玩家"}`
      : "庄：未定";
    const mainCard = state.trumpSuit ? `${state.trumpSuit}${state.level}` : `无主${state.level}`;
    const bankerLevel = state.bankerLevel ? state.bankerLevel : state.level;
    const scoreLevel = state.scoreLevel ? state.scoreLevel : state.level;
    document.getElementById("status").innerText =
      `主：${mainCard}\n${banker}\n得分：${state.score}\n南北家等级：${bankerLevel}\n东西家等级：${scoreLevel}`;
  }

  function renderReveal(state) {
    const isRevealPhase = state.phase === "reveal" || state.phase === "twist" || state.phase === "dealing";
    const areas = ["south", "west", "north", "east"];
    if (!isRevealPhase || !state.trumpReveal) {
      if (!isRevealPhase) {
        document.querySelectorAll(".played").forEach(e => {
          e.innerHTML = "";
        });
      }
      return;
    }

    document.querySelectorAll(".played").forEach(e => {
      e.innerHTML = "";
    });

    const area = areas[state.trumpReveal.player];
    const el = document.querySelector(`.${area}`);
    if (!el) return;
    const revealCards = (state.trumpRevealCards || []).filter(card => card.suit !== "JOKER");
    revealCards.forEach(card => {
      const c = createCardElement(card);
      el.appendChild(c);
    });
  }

  function renderTrumpActions(actions, phase, onReveal) {
    const el = document.getElementById("trump-actions");
    if (!el) return;
    const shouldShow = phase === "reveal" || phase === "twist" || phase === "dealing";
    const allowPendingReveal = phase === "dealing";
    el.classList.toggle("hidden", !shouldShow);
    if (!shouldShow) return;

    const existingButtons = el._actionButtons || new Map();
    const actionKeys = new Set(actions.map(action => action.key));

    actions.forEach(action => {
      let button = existingButtons.get(action.key);
      if (!button) {
        button = document.createElement("button");
        button.className = "trump-action";
        button.dataset.actionKey = action.key;
        el.appendChild(button);
        existingButtons.set(action.key, button);
      }

      const canClick = action.enabled || (allowPendingReveal && isSuitKey(action.key));
      button.textContent = action.label;
      button.disabled = !canClick;
      button.className = "trump-action";
      if (action.color) {
        button.classList.add(action.color);
      }
      if (action.enabled) {
        button.classList.add("enabled");
      } else {
        button.classList.add("disabled");
        if (allowPendingReveal && isSuitKey(action.key)) {
          button.classList.add("pending-allowed");
        }
      }
      button.onclick = canClick ? () => onReveal(action.key) : null;
    });

    existingButtons.forEach((button, key) => {
      if (!actionKeys.has(key)) {
        button.remove();
        existingButtons.delete(key);
      }
    });

    el._actionButtons = existingButtons;
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

  function isSuitKey(key) {
    return key === "♠" || key === "♥" || key === "♣" || key === "♦";
  }

  return {
    renderHand,
    renderTrick,
    renderStatus,
    renderTrumpActions,
    renderReveal
  };

})();
