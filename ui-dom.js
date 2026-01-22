// ui-dom.js

window.UIDom = (function () {
  const getById = id => document.getElementById(id);

  const clear = element => {
    if (element) {
      element.innerHTML = "";
    }
  };

  const setHidden = (element, hidden) => {
    if (element) {
      element.classList.toggle("hidden", !!hidden);
    }
  };

  const setText = (element, text = "") => {
    if (element) {
      element.textContent = text ?? "";
    }
  };

  const makeDiv = className => {
    const element = document.createElement("div");
    if (className) {
      element.className = className;
    }
    return element;
  };

  const buildTableStaticDOM = () => {
    const playedAreas = getById("played-areas");
    if (playedAreas) {
      playedAreas.innerHTML = "";
      ["north", "west", "east", "south"].forEach(area => {
        const wrapper = makeDiv(`played ${area}`);
        const slot = makeDiv("played-slot");
        wrapper.appendChild(slot);
        playedAreas.appendChild(wrapper);
      });
    }

    const trickPiles = getById("trick-piles");
    if (!trickPiles) {
      return;
    }

    trickPiles.innerHTML = "";
    const mappings = [
      { area: "south", player: 0 },
      { area: "west", player: 1 },
      { area: "north", player: 2 },
      { area: "east", player: 3 }
    ];
    mappings.forEach(({ area, player }) => {
      const pile = makeDiv(`trick-pile ${area}`);
      pile.dataset.player = player.toString();
      trickPiles.appendChild(pile);
    });
  };

  return {
    buildTableStaticDOM,
    getById,
    clear,
    setHidden,
    setText
  };
})();
