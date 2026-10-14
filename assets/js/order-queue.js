(() => {
  const notices = [...document.querySelectorAll("[data-order-queue]")];
  if (!notices.length) return;
  let snapshot = null;
  let receivedAt = 0;
  let loading = false;

  function cartBatchCount() {
    try {
      if (typeof cart === "undefined" || !cart.size || typeof getCartBrandId !== "function" || getCartBrandId() !== "kopi-kenangan") return 0;
      return buildStoredOrderBatches([...cart.values()]).length;
    } catch { return 0; }
  }

  function render() {
    const visible = typeof activeBrandId === "undefined" || activeBrandId === "kopi-kenangan";
    const current = snapshot && Date.now() - receivedAt < 90000 ? snapshot : null;
    const own = cartBatchCount();
    for (const notice of notices) {
      notice.hidden = !visible;
      if (!visible) continue;
      const title = notice.querySelector("[data-queue-title]");
      const detail = notice.querySelector("[data-queue-detail]");
      if (!current) {
        title.textContent = loading ? "Memeriksa antrean..." : "Info antrean sementara belum tersedia";
        detail.textContent = "Pesanan diproses satu per satu, sekitar 2–4 menit per batch. Estimasi dapat berubah.";
      } else {
        title.textContent = current.batches > 0
          ? `Ada ${current.batches} batch dalam antrean`
          : "Antrean kosong";
        const waiting = current.batches > 0
          ? `Perkiraan mulai diproses dalam ${current.minMinutes}–${current.maxMinutes} menit.`
          : "Pesanan bisa masuk giliran berikutnya.";
        detail.textContent = `${waiting} ${own ? `Pesanan kamu: ${own} batch, sekitar ${own * 2}–${own * 4} menit untuk diproses.` : "Proses sekitar 2–4 menit per batch."} Estimasi dapat berubah.`;
      }
    }
  }

  async function refresh() {
    if (loading || document.visibilityState === "hidden") return;
    loading = true;
    render();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const config = window.KOPI_SUPABASE_CONFIG || {};
      const base = (config.url || "https://omkboytvivjxoobyhumc.supabase.co").replace(/\/$/, "");
      const headers = config.anonKey ? { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` } : {};
      const response = await fetch(`${base}/functions/v1/order-queue`, { headers, signal: controller.signal });
      if (!response.ok) throw new Error("Queue unavailable");
      const data = await response.json();
      if (!Number.isInteger(data.batches) || data.batches < 0 || data.mode !== "sequential") throw new Error("Invalid queue");
      snapshot = data;
      receivedAt = Date.now();
    } catch { /* Keep a recent estimate; never display zero for a failed request. */ }
    finally { clearTimeout(timer); loading = false; render(); }
  }

  document.querySelector("#brandTabs")?.addEventListener("click", () => setTimeout(render, 0));
  const observer = new MutationObserver(render);
  for (const id of ["cartItems", "modalCartItems"]) {
    const element = document.getElementById(id);
    if (element) observer.observe(element, { childList: true, subtree: true });
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(); });
  setInterval(refresh, 30000);
  refresh();
})();
