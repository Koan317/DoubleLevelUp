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

  return {
    getById,
    clear,
    setHidden,
    setText
  };
})();
