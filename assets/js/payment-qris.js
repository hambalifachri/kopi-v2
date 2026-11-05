(() => {
  const panels = Array.from(document.querySelectorAll('.payment-panel'));
  if (!panels.length) return;

  function selectQris(choice) {
    panels.forEach(panel => {
      panel.querySelectorAll('[data-qris-choice]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.qrisChoice === choice));
      });
      panel.querySelectorAll('[data-qris-panel]').forEach(figure => {
        figure.hidden = figure.dataset.qrisPanel !== choice;
      });
    });
  }

  panels.forEach(panel => {
    panel.querySelectorAll('[data-qris-choice]').forEach(button => {
      button.addEventListener('click', () => selectQris(button.dataset.qrisChoice));
    });
  });

  selectQris('1');
})();
