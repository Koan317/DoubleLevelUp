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

  const buildTableStaticDOM = () => {
    const playedAreas = getById("played-areas");
    if (playedAreas) {
      playedAreas.innerHTML = "";
      ["north", "west", "east", "south"].forEach(area => {
        const wrapper = document.createElement("div");
        wrapper.className = `played ${area}`;
        const slot = document.createElement("div");
        slot.className = "played-slot";
        wrapper.appendChild(slot);
        playedAreas.appendChild(wrapper);
      });
    }

    const trickPiles = getById("trick-piles");
    if (trickPiles) {
      trickPiles.innerHTML = "";
      const mappings = [
        { area: "north", player: 2 },
        { area: "west", player: 3 },
        { area: "east", player: 1 },
        { area: "south", player: 0 }
      ];
      mappings.forEach(({ area, player }) => {
        const pile = document.createElement("div");
        pile.className = `trick-pile ${area}`;
        pile.dataset.player = player.toString();
        trickPiles.appendChild(pile);
      });
    }
  };

  return {
    buildTableStaticDOM,
    getById,
    clear,
    setHidden,
    setText
  };
})();
