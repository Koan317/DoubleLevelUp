// ui-render.js

window.Render = (function () {
  const ruleMessages = [];

  function renderHand(hand, state, onSelect, selectedCards = [], options = {}) {
    const el = document.getElementById("hand");
    el.innerHTML = "";
    el.classList.toggle("dealing", state.phase === "dealing");
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

  function renderTrick(trick, state, options = {}) {
    document.querySelectorAll(".played").forEach(e => e.innerHTML = "");
    const animatePlayer = options.animatePlayer ?? null;
    const lastPlay = trick[trick.length - 1];

    trick.forEach(t => {
      const area = ["south","west","north","east"][t.player];
      const el = document.querySelector(`.${area}`);
      const sortedCards = state ? t.cards.slice().sort((a, b) => sortHandCards(a, b, state)) : t.cards;
      sortedCards.forEach(card => {
        const c = createCardElement(card);
        if (lastPlay && t.player === animatePlayer && t === lastPlay) {
          c.classList.add("play-animate");
        }
        el.appendChild(c);
      });
    });
  }

  function renderStatus(state) {
    const playerLabels = ["南家", "西家", "北家", "东家"];
    const banker = state.trumpReveal
      ? `庄：${playerLabels[state.trumpReveal.player] || "玩家"}`
      : "庄：未定";
    const isDoubleSuit = state.trumpReveal?.reveal?.type === "ONE_WANG_TWO";
    const suitDisplay = state.trumpSuit
      ? `${state.trumpSuit}${isDoubleSuit ? state.trumpSuit : ""}`
      : "无主";
    const mainCard = state.trumpSuit ? `${suitDisplay}${state.level}` : `无主${state.level}`;
    const bankerLevel = state.bankerLevel ? state.bankerLevel : state.level;
    const scoreLevel = state.scoreLevel ? state.scoreLevel : state.level;
    document.getElementById("status").innerText =
      `主：${mainCard}\n${banker}\n南北家等级：${bankerLevel}\n东西家等级：${scoreLevel}`;
    const scoreEl = document.getElementById("score-display");
    if (scoreEl) {
      scoreEl.textContent = `得分 ${state.score}`;
    }
    renderBankerBadge(state);
    renderRuleMessage(state.invalidActionReason);
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

  function renderKitty(state) {
    const el = document.getElementById("kitty");
    if (!el) return;
    if (!state.kittyVisible) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }
    el.classList.remove("hidden");
    el.innerHTML = "";
    const cardCount = state.kitty?.length || 8;
    if (state.kittyRevealed) {
      state.kitty.forEach((card, index) => {
        const face = createCardElement(card);
        face.classList.add("kitty-faceup");
        face.style.setProperty("--kitty-faceup-x", `${index * 6}px`);
        face.style.setProperty("--kitty-faceup-y", `${index * 2}px`);
        el.appendChild(face);
      });
    } else {
      for (let i = 0; i < cardCount; i += 1) {
        const card = createCardBackElement();
        card.classList.add("kitty-card");
        card.style.left = `${i * 6}px`;
        card.style.top = `${i * 2}px`;
        el.appendChild(card);
      }
    }
    if (state.kittyRevealCard) {
      const reveal = createCardElement(state.kittyRevealCard);
      reveal.classList.add("kitty-reveal");
      el.appendChild(reveal);
    }
  }

  function renderTrumpActions(actions, phase, onReveal, options = {}) {
    const el = document.getElementById("trump-actions");
    if (!el) return;
    const { revealWindowOpen } = options;
    const shouldShow = revealWindowOpen ?? (phase === "reveal" || phase === "twist" || phase === "dealing");
    const allowPendingReveal = options.allowPendingReveal ?? phase === "dealing";
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

  function createCardBackElement() {
    const el = document.createElement("div");
    el.className = "card back";
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

  function animateKittyTransfer(bankerIndex, onComplete, options = {}) {
    const kitty = document.getElementById("kitty");
    if (!kitty) {
      if (onComplete) onComplete();
      return;
    }
    const area = ["south", "west", "north", "east"][bankerIndex];
    const target = document.querySelector(`.${area}`);
    if (!target) {
      if (onComplete) onComplete();
      return;
    }
    const kittyRect = kitty.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const deltaX = targetRect.left + targetRect.width / 2 - (kittyRect.left + kittyRect.width / 2);
    const deltaY = targetRect.top + targetRect.height / 2 - (kittyRect.top + kittyRect.height / 2);
    kitty.style.setProperty("--kitty-target-x", `${deltaX}px`);
    kitty.style.setProperty("--kitty-target-y", `${deltaY}px`);
    const cards = kitty.querySelectorAll(".kitty-card");
    cards.forEach(card => card.classList.add("kitty-move"));
    if (!options.keepAtTarget) {
      setTimeout(() => {
        cards.forEach(card => card.classList.remove("kitty-move"));
      }, 700);
    }
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 1400);
  }

  function renderBankerBadge(state) {
    const badge = document.getElementById("banker-badge");
    if (!badge) return;
    const table = document.getElementById("table");
    const area = state.trumpReveal ? ["south", "west", "north", "east"][state.trumpReveal.player] : null;
    if (!area || !table) {
      badge.className = "banker-badge hidden";
      badge.textContent = "";
      return;
    }

    const tableRect = table.getBoundingClientRect();
    const pile = document.querySelector(`.trick-pile.${area}`);
    if (!pile) {
      badge.className = "banker-badge hidden";
      badge.textContent = "";
      return;
    }
    const pileRect = pile.getBoundingClientRect();
    const gap = 18;
    let top = pileRect.top - tableRect.top + pileRect.height / 2;
    let left = pileRect.left - tableRect.left + pileRect.width / 2;

    if (area === "north") {
      top = pileRect.top - tableRect.top - gap;
    } else if (area === "south") {
      top = pileRect.bottom - tableRect.top + gap;
    } else if (area === "west") {
      left = pileRect.left - tableRect.left - gap;
    } else if (area === "east") {
      left = pileRect.right - tableRect.left + gap;
    }

    badge.textContent = "庄";
    badge.className = "banker-badge";
    badge.style.top = `${top}px`;
    badge.style.left = `${left}px`;
    badge.style.transform = "translate(-50%, -50%) rotate(-6deg)";
  }

  function animateKittyReturn(onComplete) {
    const kitty = document.getElementById("kitty");
    if (!kitty) {
      if (onComplete) onComplete();
      return;
    }
    const cards = kitty.querySelectorAll(".kitty-card");
    cards.forEach(card => {
      card.classList.remove("kitty-move");
      card.classList.add("kitty-return");
    });
    setTimeout(() => {
      cards.forEach(card => card.classList.remove("kitty-return"));
      if (onComplete) onComplete();
    }, 700);
  }

  function renderCountdown(countdownValue) {
    const el = document.getElementById("reveal-countdown");
    if (!el) return;
    if (countdownValue === null || countdownValue === undefined) {
      el.classList.add("hidden");
      el.textContent = "";
      return;
    }
    el.textContent = countdownValue.toString();
    el.classList.remove("hidden");
  }

  function renderRuleMessage(message) {
    const el = document.getElementById("rule-message");
    if (!el) return;
    if (message === null || message === undefined || message === "") {
      return;
    }
    const lastMessage = ruleMessages[ruleMessages.length - 1];
    if (lastMessage === message) {
      return;
    }
    ruleMessages.push(message);
    while (ruleMessages.length > 20) {
      ruleMessages.shift();
    }
    el.innerHTML = "";
    ruleMessages.forEach((msg, index) => {
      const item = document.createElement("div");
      item.textContent = msg;
      el.appendChild(item);
      if (index < ruleMessages.length - 1) {
        const divider = document.createElement("div");
        divider.className = "rule-divider";
        el.appendChild(divider);
      }
    });
    el.scrollTop = el.scrollHeight;
  }

  function renderKittyMultiplier(multiplier, visible) {
    const el = document.getElementById("kitty-multiplier");
    if (!el) return;
    if (!visible) {
      el.classList.add("hidden");
      el.textContent = "";
      return;
    }
    el.textContent = `×${multiplier ?? 0}`;
    el.classList.remove("hidden");
  }

  function renderTrickPiles(state, onPileClick) {
    const piles = document.querySelectorAll(".trick-pile");
    piles.forEach(pile => {
      pile.innerHTML = "";
      const playerIndex = Number(pile.dataset.player);
      const history = state.trickHistory?.[playerIndex] || [];
      if (!history.length) {
        pile.onclick = null;
        return;
      }
      const lastEntry = history[history.length - 1];
      lastEntry.cards.forEach(card => {
        const c = createCardElement(card);
        pile.appendChild(c);
      });
      pile.onclick = () => onPileClick(playerIndex);
    });
  }

  function renderKittyOwnerProof(playerIndex, card) {
    const area = ["south","west","north","east"][playerIndex];
    const el = document.querySelector(`.${area}`);
    if (!el) return;
    el.innerHTML = "";
    const proof = createCardElement(card);
    proof.classList.add("kitty-proof");
    el.appendChild(proof);
  }

  function showPileModal(playerIndex, state) {
    const modal = document.getElementById("pile-modal");
    const body = modal?.querySelector(".pile-modal-body");
    if (!modal || !body) return;
    body.innerHTML = "";
    const history = state.trickHistory?.[playerIndex] || [];
    history.forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "pile-entry";
      const header = document.createElement("div");
      header.className = "pile-entry-header";
      header.textContent = `回合 ${entry.trickIndex ?? index + 1}`;
      if (entry.isMax) {
        const maxTag = document.createElement("span");
        maxTag.className = "pile-entry-max";
        maxTag.textContent = "最大";
        header.appendChild(maxTag);
      }
      const cards = document.createElement("div");
      cards.className = "pile-entry-cards";
      entry.cards.forEach(card => {
        cards.appendChild(createCardElement(card));
      });
      item.appendChild(header);
      item.appendChild(cards);
      body.appendChild(item);
    });
    modal.classList.remove("hidden");
  }

  function hidePileModal() {
    const modal = document.getElementById("pile-modal");
    if (!modal) return;
    modal.classList.add("hidden");
  }

  function bindPileModalHandlers() {
    const modal = document.getElementById("pile-modal");
    if (!modal || modal.dataset.bound) return;
    const closeButton = modal.querySelector(".pile-modal-close");
    if (closeButton) {
      closeButton.onclick = () => hidePileModal();
    }
    modal.onclick = event => {
      if (event.target === modal) {
        hidePileModal();
      }
    };
    modal.dataset.bound = "true";
  }

  function setPlayButtonEnabled(enabled) {
    const button = document.getElementById("playButton");
    if (!button) return;
    button.disabled = !enabled;
  }

  function setPlayButtonVisible(visible) {
    const button = document.getElementById("playButton");
    if (!button) return;
    button.classList.toggle("hidden", !visible);
  }

  function setPlayButtonLabel(label) {
    const button = document.getElementById("playButton");
    if (!button) return;
    button.textContent = label;
  }

  function setNextRoundButtonVisible(visible) {
    const button = document.getElementById("nextRoundButton");
    if (!button) return;
    button.classList.toggle("hidden", !visible);
  }

  return {
    renderHand,
    renderTrick,
    renderStatus,
    renderTrumpActions,
    renderReveal,
    renderCountdown,
    renderKitty,
    animateKittyTransfer,
    animateKittyReturn,
    renderRuleMessage,
    renderKittyMultiplier,
    renderTrickPiles,
    renderKittyOwnerProof,
    showPileModal,
    hidePileModal,
    bindPileModalHandlers,
    setPlayButtonEnabled,
    setPlayButtonVisible,
    setPlayButtonLabel,
    setNextRoundButtonVisible
  };

})();
