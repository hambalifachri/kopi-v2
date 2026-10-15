(() => {
  const root = document.documentElement;
  let frame = 0;
  const update = () => {
    frame = 0;
    const viewport = window.visualViewport;
    root.style.setProperty('--dialog-viewport-height', `${viewport?.height || window.innerHeight}px`);
    root.style.setProperty('--dialog-viewport-top', `${viewport?.offsetTop || 0}px`);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('scroll', schedule, { passive: true });
  update();
})();
