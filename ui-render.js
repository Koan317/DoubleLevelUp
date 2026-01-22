// ui-render.js

window.Render = (function () {
  const { PLAYER_AREAS, PLAYER_LABELS, REVEAL_PHASES, TRUMP_ACTION_PHASES } = window.UIConstants;
  const { getById, clear, setHidden, setText } = window.UIDom;
  const {
    createCardElement,
    createCardBackElement,
    sortHandCards,
    isSuitKey
  } = window.CardUI;

  const ruleMessages = [];
  const trickPileRotationRange = { min: 5, max: 10 };

  function getArea(playerIndex) {
    return PLAYER_AREAS[playerIndex];
  }

  function randomTrickPileRotation() {
    const magnitude = trickPileRotationRange.min
      + Math.random() * (trickPileRotationRange.max - trickPileRotationRange.min);
    const sign = Math.random() < 0.5 ? -1 : 1;
    return magnitude * sign;
  }

  function clearPlayedSlots() {
    document.querySelectorAll(".played-slot").forEach(slot => {
      slot.innerHTML = "";
    });
  }

  function renderHand(hand, state, onSelect, selectedCards = [], options = {}) {
    const el = getById("hand");
    if (!el) return;
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

    const sortedHand = hand
      .slice()
      .sort((a, b) => sortHandCards(a, b, state));
    let previousTrump = null;

    sortedHand.forEach(card => {
      const c = createCardElement(card);
      const isTrump = Rules.isTrump(card, state);
      if (previousTrump === null) {
        previousTrump = isTrump;
      } else if (previousTrump && !isTrump) {
        c.classList.add("hand-sub-start");
        previousTrump = isTrump;
      }
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
    clearPlayedSlots();
    const animatePlayer = options.animatePlayer ?? null;
    const lastPlay = trick[trick.length - 1];

    trick.forEach(t => {
      const area = getArea(t.player);
      const el = document.querySelector(`.played.${area} .played-slot`);
      if (!el) return;
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
    const banker = state.trumpReveal
      ? `庄：${PLAYER_LABELS[state.trumpReveal.player] || "玩家"}`
      : "庄：未定";
    const isDoubleSuit = state.trumpReveal?.reveal?.type === "ONE_WANG_TWO";
    const suitDisplay = state.trumpSuit
      ? `${state.trumpSuit}${isDoubleSuit ? state.trumpSuit : ""}`
      : "无主";
    const mainCard = state.trumpSuit ? `${suitDisplay}${state.level}` : `无主${state.level}`;
    const revealInfo = state.initialRevealInfo
      ? `亮主：${PLAYER_LABELS[state.initialRevealInfo.player] || "玩家"}${state.initialRevealInfo.label ? ` ${state.initialRevealInfo.label}` : ""}`
      : "亮主：未定";
    const bankerLevel = state.bankerLevel ? state.bankerLevel : state.level;
    const scoreLevel = state.scoreLevel ? state.scoreLevel : state.level;
    const status = getById("status");
    if (status) {
      status.innerText =
        `主：${mainCard}\n${banker}\n${revealInfo}\n南北家等级：${bankerLevel}\n东西家等级：${scoreLevel}`;
    }
    const scoreEl = getById("score-display");
    if (scoreEl) {
      scoreEl.textContent = `得分 ${state.score}`;
    }
    renderBankerBadge(state);
    renderRuleMessage(state.invalidActionReason);
  }

  function renderReveal(state) {
    const isRevealPhase = REVEAL_PHASES.has(state.phase);
    if (!isRevealPhase || !state.trumpReveal) {
      if (!isRevealPhase) {
        clearPlayedSlots();
      }
      return;
    }

    clearPlayedSlots();

    const revealPlayer = state.lastTwistPlayer ?? state.trumpReveal.player;
    const area = getArea(revealPlayer);
    const el = document.querySelector(`.played.${area} .played-slot`);
    if (!el) return;
    const revealCards = state.trumpRevealCards || [];
    revealCards.forEach(card => {
      const c = createCardElement(card);
      el.appendChild(c);
    });
  }

  function renderKitty(state) {
    const el = getById("kitty");
    if (!el) return;
    if (!state.kittyVisible) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }
    el.classList.remove("hidden");
    el.innerHTML = "";
    const cardCount = state.kitty?.length || 8;
    const stackRevealed = state.kittyRevealed && state.phase === "settle";
    el.classList.toggle("kitty-stacked", stackRevealed);
    if (state.kittyRevealed) {
      const faceupOffsetX = stackRevealed ? 2 : 6;
      const faceupOffsetY = stackRevealed ? 2 : 2;
      state.kitty.forEach((card, index) => {
        const face = createCardElement(card);
        face.classList.add("kitty-faceup");
        face.style.setProperty("--kitty-faceup-x", `${index * faceupOffsetX}px`);
        face.style.setProperty("--kitty-faceup-y", `${index * faceupOffsetY}px`);
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

  function updateActionButton(button, action, canClick, pendingAllowed) {
    button.textContent = action.label;
    button.disabled = !canClick;
    button.className = "trump-action";
    if (action.color) {
      button.classList.add(action.color);
    }
    button.classList.toggle("enabled", !!action.enabled);
    button.classList.toggle("disabled", !action.enabled);
    button.classList.toggle("pending-allowed", pendingAllowed);
  }

  function renderTrumpActions(actions, phase, onReveal, options = {}) {
    const el = getById("trump-actions");
    if (!el) return;
    const hasFlag = Object.prototype.hasOwnProperty.call(options, "revealWindowOpen");
    const shouldShow = hasFlag
      ? options.revealWindowOpen
      : TRUMP_ACTION_PHASES.has(phase);
    const allowPendingReveal = options.allowPendingReveal ?? phase === "dealing";
    const revealJokersOnly = phase === "reveal" && options.revealOnlyJokers;
    const isRevealKey = key => (revealJokersOnly ? (key === "BJ" || key === "SJ") : isSuitKey(key));
    const visibleActions = phase === "reveal"
      ? actions.filter(action => isRevealKey(action.key))
      : actions;
    setHidden(el, !shouldShow);
    if (!shouldShow) return;

    const existingButtons = el._actionButtons || new Map();
    const actionKeys = new Set(visibleActions.map(action => action.key));

    visibleActions.forEach(action => {
      let button = existingButtons.get(action.key);
      if (!button) {
        button = document.createElement("button");
        button.className = "trump-action";
        button.dataset.actionKey = action.key;
        el.appendChild(button);
        existingButtons.set(action.key, button);
      }

      const canClick = action.enabled || (allowPendingReveal && isRevealKey(action.key));
      const pendingAllowed = !action.enabled && allowPendingReveal && isRevealKey(action.key);
      updateActionButton(button, action, canClick, pendingAllowed);
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

  function animateKittyTransfer(bankerIndex, onComplete, options = {}) {
    const kitty = getById("kitty");
    if (!kitty) {
      if (onComplete) onComplete();
      return;
    }
    const area = getArea(bankerIndex);
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
    const badge = getById("banker-badge");
    if (!badge) return;
    const hideBadge = target => {
      target.className = "banker-badge hidden";
      target.textContent = "";
    };
    const table = getById("table");
    const area = state.trumpReveal ? getArea(state.trumpReveal.player) : null;
    if (!area || !table) return hideBadge(badge);

    const tableRect = table.getBoundingClientRect();
    const pile = document.querySelector(`.trick-pile.${area}`);
    if (!pile) return hideBadge(badge);
    const pileRect = pile.getBoundingClientRect();
    const gap = 18;
    let top = pileRect.top - tableRect.top + pileRect.height / 2;
    let left = pileRect.left - tableRect.left + pileRect.width / 2;

    switch (area) {
      case "north":
        top = pileRect.top - tableRect.top - gap;
        break;
      case "south":
        top = pileRect.bottom - tableRect.top + gap;
        break;
      case "west":
        left = pileRect.left - tableRect.left - gap;
        break;
      case "east":
        left = pileRect.right - tableRect.left + gap;
        break;
    }

    badge.textContent = "庄";
    badge.className = "banker-badge";
    badge.style.top = `${top}px`;
    badge.style.left = `${left}px`;
    badge.style.transform = "translate(-50%, -50%) rotate(-6deg)";
  }

  function animateKittyReturn(onComplete) {
    const kitty = getById("kitty");
    if (!kitty) {
      if (onComplete) onComplete();
      return;
    }
    const cards = kitty.querySelectorAll(".kitty-card");
    cards.forEach(card => {
      card.classList.remove("kitty-return");
      card.classList.add("kitty-instant");
      card.classList.add("kitty-move");
    });
    requestAnimationFrame(() => {
      cards.forEach(card => {
        card.classList.remove("kitty-instant");
        card.classList.remove("kitty-move");
        card.classList.add("kitty-return");
      });
      setTimeout(() => {
        cards.forEach(card => card.classList.remove("kitty-return"));
        if (onComplete) onComplete();
      }, 700);
    });
  }

  function renderCountdown(countdownValue) {
    const el = getById("reveal-countdown");
    if (!el) return;
    if (countdownValue === null || countdownValue === undefined) {
      setHidden(el, true);
      setText(el, "");
      return;
    }
    setText(el, countdownValue.toString());
    setHidden(el, false);
  }

  function renderTurnArrow(playerIndex) {
    const table = getById("table");
    if (!table) return;
    let arrow = getById("turn-arrow");
    if (!arrow) {
      arrow = document.createElement("div");
      arrow.id = "turn-arrow";
      arrow.className = "turn-arrow hidden";
      arrow.textContent = "▲";
      table.appendChild(arrow);
    }
    if (playerIndex === null || playerIndex === undefined) {
      setHidden(arrow, true);
      return;
    }
    const area = getArea(playerIndex);
    const target = document.querySelector(`.${area}`);
    if (!target) {
      setHidden(arrow, true);
      return;
    }
    const tableRect = table.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const offset = 12;
    let top = 0;
    let left = 0;
    let rotation = 0;

    switch (area) {
      case "north":
        top = targetRect.bottom - tableRect.top + offset;
        left = targetRect.left - tableRect.left + targetRect.width / 2;
        rotation = 0;
        break;
      case "south":
        top = targetRect.top - tableRect.top - offset;
        left = targetRect.left - tableRect.left + targetRect.width / 2;
        rotation = 180;
        break;
      case "west":
        top = targetRect.top - tableRect.top + targetRect.height / 2;
        left = targetRect.right - tableRect.left + offset;
        rotation = -90;
        break;
      case "east":
        top = targetRect.top - tableRect.top + targetRect.height / 2;
        left = targetRect.left - tableRect.left - offset;
        rotation = 90;
        break;
    }

    arrow.style.top = `${top}px`;
    arrow.style.left = `${left}px`;
    arrow.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
    setHidden(arrow, false);
  }

  function renderRuleMessage(message) {
    const el = getById("rule-message");
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
    const el = getById("kitty-multiplier");
    if (!el) return;
    if (!visible) {
      setHidden(el, true);
      setText(el, "");
      return;
    }
    setText(el, `×${multiplier ?? 0}`);
    setHidden(el, false);
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
        c.style.transform = `rotate(${randomTrickPileRotation().toFixed(2)}deg)`;
        pile.appendChild(c);
      });
      pile.onclick = () => onPileClick(playerIndex);
    });
  }

  function renderKittyOwnerProof(playerIndex, card) {
    const area = getArea(playerIndex);
    const el = document.querySelector(`.${area}`);
    if (!el) return;
    let slot = el.querySelector(".kitty-proof-slot");
    if (!slot) {
      slot = document.createElement("div");
      slot.className = "kitty-proof-slot";
      el.appendChild(slot);
    }
    slot.innerHTML = "";
    const proof = createCardElement(card);
    proof.classList.add("kitty-proof");
    slot.appendChild(proof);
  }

  function clearKittyOwnerProof() {
    document.querySelectorAll(".kitty-proof-slot").forEach(slot => {
      slot.remove();
    });
  }

  function showPileModal(playerIndex, state) {
    const modal = getById("pile-modal");
    const body = modal?.querySelector(".pile-modal-body");
    if (!modal || !body) return;
    clear(body);
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
    setHidden(modal, false);
  }

  function hidePileModal() {
    const modal = getById("pile-modal");
    if (!modal) return;
    setHidden(modal, true);
  }

  function bindPileModalHandlers() {
    const modal = getById("pile-modal");
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
    const button = getById("playButton");
    if (!button) return;
    button.disabled = !enabled;
  }

  function setPlayButtonVisible(visible) {
    const button = getById("playButton");
    if (!button) return;
    setHidden(button, !visible);
  }

  function setPlayButtonLabel(label) {
    const button = getById("playButton");
    if (!button) return;
    button.textContent = label;
  }

  function setNextRoundButtonVisible(visible) {
    const button = getById("nextRoundButton");
    if (!button) return;
    setHidden(button, !visible);
  }

  return {
    renderHand,
    renderTrick,
    renderStatus,
    renderTrumpActions,
    renderReveal,
    renderCountdown,
    renderTurnArrow,
    renderKitty,
    animateKittyTransfer,
    animateKittyReturn,
    renderRuleMessage,
    renderKittyMultiplier,
    renderTrickPiles,
    renderKittyOwnerProof,
    clearKittyOwnerProof,
    showPileModal,
    hidePileModal,
    bindPileModalHandlers,
    setPlayButtonEnabled,
    setPlayButtonVisible,
    setPlayButtonLabel,
    setNextRoundButtonVisible
  };

})();
