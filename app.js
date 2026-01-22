// app.js

document.getElementById("themeToggle").onclick = () => {
  document.body.classList.toggle("dark");
  document.body.classList.toggle("light");
};

const playButton = document.getElementById("playButton");
if (playButton) {
  playButton.onclick = () => Game.playSelected();
}

const nextRoundButton = document.getElementById("nextRoundButton");
if (nextRoundButton) {
  nextRoundButton.onclick = () => Game.startNextRound();
}

const clearSaveButton = document.getElementById("clearSaveButton");
if (clearSaveButton) {
  clearSaveButton.onclick = () => Game.clearSavedLevels();
}

Game.startGame();
