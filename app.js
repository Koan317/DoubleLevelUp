// app.js

if (window.UIDom?.buildTableStaticDOM) {
  window.UIDom.buildTableStaticDOM();
}

function bindClick(id, handler) {
  const el = document.getElementById(id);
  if (el) el.onclick = handler;
}

bindClick("themeToggle", () => {
  document.body.classList.toggle("dark");
  document.body.classList.toggle("light");
});

bindClick("playButton", () => Game.playSelected());
bindClick("nextRoundButton", () => Game.startNextRound());
bindClick("clearSaveButton", () => Game.clearSavedLevels());

Game.startGame();
