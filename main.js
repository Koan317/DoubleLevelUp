// main.js

document.getElementById("themeToggle").onclick = () => {
  document.body.classList.toggle("dark");
  document.body.classList.toggle("light");
};

const playButton = document.getElementById("playButton");
if (playButton) {
  playButton.onclick = () => Game.playSelected();
}

Game.startGame();
