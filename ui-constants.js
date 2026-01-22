// ui-constants.js

window.UIConstants = (function () {
  const PLAYER_AREAS = Object.freeze(["south", "west", "north", "east"]);
  const PLAYER_LABELS = Object.freeze(["南家", "西家", "北家", "东家"]);
  const REVEAL_PHASES = new Set(["reveal", "twist", "dealing", "kitty"]);
  const TRUMP_ACTION_PHASES = new Set(["reveal", "twist", "dealing"]);

  return {
    PLAYER_AREAS,
    PLAYER_LABELS,
    REVEAL_PHASES,
    TRUMP_ACTION_PHASES
  };
})();
