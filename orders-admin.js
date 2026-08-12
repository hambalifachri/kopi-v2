const config = window.KOPI_SUPABASE_CONFIG;
const client = window.supabase.createClient(config.url, config.anonKey);
const loginPanel = document.querySelector("#loginPanel");
const ordersPanel = document.querySelector("#ordersPanel");
const logoutButton = document.querySelector("#logoutButton");
const loginForm = document.querySelector("#loginForm");
const loginStatus = document.querySelector("#loginStatus");
const ordersStatus = document.querySelector("#ordersStatus");
const ordersList = document.querySelector("#ordersList");
const orderSearch = document.querySelector("#orderSearch");
const statusFilter = document.querySelector("#statusFilter");
const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
let orders = [];
let ordersChannel = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character]));
}

function statusLabel(status) {
  return { new: "Baru", processing: "Diproses", completed: "Selesai", cancelled: "Dibatalkan" }[status] || status;
}

function formatDate(value) {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function formatOptions(options) {
  if (!options || typeof options !== "object") return "";
  return Object.entries(options).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(" / ");
}

function formatOptionLabel(key) {
  return String(key || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatItemForCopy(item, index) {
  const qty = Number(item.qty) || 1;
  const officialPrice = Number(item.officialPrice) || Number(item.price) || 0;
  const sellingPrice = Number(item.price) || 0;
  const lines = [`${index + 1}. *${qty}x ${item.name}* (~${rupiah.format(officialPrice)}~ *${rupiah.format(sellingPrice)}*)`];
  const optionOrder = ["temperature", "size", "beans", "milk", "sugar", "ice", "topping", "addon"];
  const options = Object.entries(item.options || {})
    .filter(([, value]) => value)
    .sort(([firstKey], [secondKey]) => {
      const firstIndex = optionOrder.indexOf(firstKey);
      const secondIndex = optionOrder.indexOf(secondKey);
      return (firstIndex < 0 ? optionOrder.length : firstIndex) - (secondIndex < 0 ? optionOrder.length : secondIndex);
    });

  options.forEach(([key, value], optionIndex) => {
    const branch = optionIndex === options.length - 1 ? "└" : "├";
    lines.push(`   ${branch} ${formatOptionLabel(key)}: ${value}`);
  });
  if (item.resellerDiscount) lines.push(`   Potongan reseller: -${rupiah.format(item.resellerDiscount)} / item`);
  if (String(item.note || "").trim()) lines.push(`   Catatan: ${String(item.note).trim()}`);
  return lines.join("\n");
}

const KOPKEN_BATCH_MIN_TOTAL = 50000;
const KOPKEN_BATCH_MAX_TOTAL = 70000;

function getCatalogKopkenItem(item) {
  if (typeof MENU_ITEMS_DATA === "undefined") return null;
  return MENU_ITEMS_DATA.find((menuItem) => {
    const isKopken = !menuItem.brand || menuItem.brand === "kopi-kenangan";
    return isKopken && ((item.id && menuItem.id === item.id) || menuItem.name === item.name);
  }) || null;
}

function getStoredOfficialPrice(item) {
  const savedPrice = Number(item.officialPrice) || Number(item.oldPrice);
  if (savedPrice > 0) return savedPrice;
  const menuItem = getCatalogKopkenItem(item);
  if (!menuItem) return Number(item.price) || 0;

  let officialPrice = Number(menuItem.oldPrice) || Number(menuItem.price) || Number(item.price) || 0;
  const size = String(item.options?.size || item.options?.cupSize || "").toLowerCase();
  if (size === "large" && !menuItem.noRegular) {
    officialPrice = Number(menuItem.oldLargePrice || menuItem.largeOldPrice || menuItem.largeOrigPrice)
      || officialPrice + Math.max(0, (Number(menuItem.largePrice) || Number(menuItem.price) || 0) - (Number(menuItem.price) || 0));
  } else if (size === "jumbo") {
    const baseSellingPrice = menuItem.noRegular
      ? Number(menuItem.largePrice) || Number(menuItem.price) || 0
      : Number(menuItem.price) || 0;
    officialPrice = Number(menuItem.oldJumboPrice || menuItem.jumboOldPrice || menuItem.jumboOrigPrice)
      || officialPrice + Math.max(0, (Number(menuItem.jumboPrice) || baseSellingPrice) - baseSellingPrice);
  }
  return officialPrice;
}

function findValidBatchPartition(items, batchCount) {
  const sortedItems = [...items].sort((a, b) => b.officialUnitPrice - a.officialUnitPrice);
  const buckets = Array.from({ length: batchCount }, () => []);
  const totals = Array(batchCount).fill(0);

  function assignItem(itemIndex) {
    if (itemIndex === sortedItems.length) {
      return totals.every((total) => total >= KOPKEN_BATCH_MIN_TOTAL && total <= KOPKEN_BATCH_MAX_TOTAL);
    }
    const item = sortedItems[itemIndex];
    const attemptedTotals = new Set();
    const candidates = totals
      .map((total, index) => ({ total, index }))
      .filter(({ total }) => total + item.officialUnitPrice <= KOPKEN_BATCH_MAX_TOTAL)
      .sort((a, b) => b.total - a.total);
    for (const { total, index } of candidates) {
      if (attemptedTotals.has(total)) continue;
      attemptedTotals.add(total);
      buckets[index].push(item);
      totals[index] += item.officialUnitPrice;
      if (assignItem(itemIndex + 1)) return true;
      totals[index] -= item.officialUnitPrice;
      buckets[index].pop();
    }
    return false;
  }

  return assignItem(0) ? buckets.filter((bucket) => bucket.length) : null;
}

function buildBatchFallback(items) {
  const buckets = [];
  [...items].sort((a, b) => b.officialUnitPrice - a.officialUnitPrice).forEach((item) => {
    const target = buckets
      .map((bucket, index) => ({ index, total: bucket.reduce((sum, current) => sum + current.officialUnitPrice, 0) }))
      .filter(({ total }) => total + item.officialUnitPrice <= KOPKEN_BATCH_MAX_TOTAL)
      .sort((a, b) => b.total - a.total)[0];
    if (target) buckets[target.index].push(item);
    else buckets.push([item]);
  });

  let improved = true;
  while (improved) {
    improved = false;
    const currentDeficit = buckets.reduce(
      (sum, bucket) => sum + Math.max(0, KOPKEN_BATCH_MIN_TOTAL - bucket.reduce((total, item) => total + item.officialUnitPrice, 0)),
      0,
    );

    for (let fromIndex = 0; fromIndex < buckets.length && !improved; fromIndex += 1) {
      for (let itemIndex = 0; itemIndex < buckets[fromIndex].length && !improved; itemIndex += 1) {
        for (let toIndex = 0; toIndex < buckets.length; toIndex += 1) {
          if (fromIndex === toIndex) continue;
          const item = buckets[fromIndex][itemIndex];
          const targetTotal = buckets[toIndex].reduce((sum, current) => sum + current.officialUnitPrice, 0);
          if (targetTotal + item.officialUnitPrice > KOPKEN_BATCH_MAX_TOTAL) continue;

          buckets[fromIndex].splice(itemIndex, 1);
          buckets[toIndex].push(item);
          const candidateBuckets = buckets.filter((bucket) => bucket.length);
          const candidateDeficit = candidateBuckets.reduce(
            (sum, bucket) => sum + Math.max(0, KOPKEN_BATCH_MIN_TOTAL - bucket.reduce((total, current) => total + current.officialUnitPrice, 0)),
            0,
          );
          if (candidateDeficit < currentDeficit) {
            buckets.splice(0, buckets.length, ...candidateBuckets);
            improved = true;
            break;
          }
          buckets[toIndex].pop();
          buckets[fromIndex].splice(itemIndex, 0, item);
        }
      }
    }
  }
  return buckets.filter((bucket) => bucket.length);
}

function reconstructKopkenBatches(items) {
  const units = items.flatMap((item) => Array.from({ length: Number(item.qty) || 1 }, () => ({
    ...item,
    qty: 1,
    officialPrice: getStoredOfficialPrice(item),
    officialUnitPrice: getStoredOfficialPrice(item),
  })));
  const total = units.reduce((sum, item) => sum + item.officialUnitPrice, 0);
  const minimumBatchCount = Math.max(1, Math.ceil(total / KOPKEN_BATCH_MAX_TOTAL));
  const maximumBatchCount = Math.floor(total / KOPKEN_BATCH_MIN_TOTAL);
  let buckets = null;
  for (let count = minimumBatchCount; count <= maximumBatchCount && !buckets; count += 1) {
    buckets = findValidBatchPartition(units, count);
  }
  buckets ||= buildBatchFallback(units);

  return buckets.map((bucket, index) => {
    const groupedItems = [];
    bucket.forEach((item) => {
      const key = `${item.id || item.name}|${JSON.stringify(item.options || {})}|${item.note || ""}`;
      const existing = groupedItems.find((candidate) => candidate.batchKey === key);
      if (existing) existing.qty += 1;
      else groupedItems.push({ ...item, batchKey: key });
    });
    return {
      number: index + 1,
      officialTotal: bucket.reduce((sum, item) => sum + item.officialUnitPrice, 0),
      sellingTotal: bucket.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
      items: groupedItems,
    };
  });
}

function getOrderBatches(order) {
  if (Array.isArray(order.batches) && order.batches.length) return order.batches;
  const items = Array.isArray(order.items) ? order.items : [];
  const canReconstructKopken = items.length > 0 && items.every((item) => Boolean(getCatalogKopkenItem(item)));
  if (canReconstructKopken) return reconstructKopkenBatches(items);
  const fallbackOfficialTotal = items.reduce((sum, item) => {
    const unitPrice = getStoredOfficialPrice(item);
    return sum + unitPrice * (Number(item.qty) || 1);
  }, 0);
  const fallbackSellingTotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1), 0);
  return [{
    number: 1,
    officialTotal: Number(order.official_total) || fallbackOfficialTotal,
    sellingTotal: Number(order.subtotal) || fallbackSellingTotal,
    items,
  }];
}

function showAuthenticated(authenticated) {
  loginPanel.hidden = authenticated;
  ordersPanel.hidden = !authenticated;
  logoutButton.hidden = !authenticated;
}

function renderMetrics() {
  document.querySelector("#newOrderCount").textContent = orders.filter((order) => order.status === "new").length;
  document.querySelector("#processingOrderCount").textContent = orders.filter((order) => order.status === "processing").length;
  document.querySelector("#completedOrderCount").textContent = orders.filter((order) => order.status === "completed").length;
}

function orderMatches(order) {
  const filter = statusFilter.value;
  if (filter !== "all" && order.status !== filter) return false;
  const query = orderSearch.value.trim().toLowerCase();
  if (!query) return true;
  return [order.id, order.customer_name, order.customer_address, order.brand, order.customer_phone, order.customer_email]
    .some((value) => String(value || "").toLowerCase().includes(query));
}

function renderOrderCard(order) {
  const contact = order.contact_method === "email" ? order.customer_email : order.customer_phone;
  const batches = getOrderBatches(order);
  const batchHtml = batches.map((batch) => `
    <section class="batch">
      <div class="batch-title"><strong>Batch ${batch.number}</strong><span>Outlet ${rupiah.format(batch.officialTotal || 0)} · Bayar ${rupiah.format(batch.sellingTotal || 0)}</span></div>
      ${(batch.items || []).map((item) => `
        <div class="batch-item">
          <div><strong>${item.qty}x ${escapeHtml(item.name)}</strong>
            ${formatOptions(item.options) ? `<p>${escapeHtml(formatOptions(item.options))}</p>` : ""}
            ${item.note ? `<p>Catatan: ${escapeHtml(item.note)}</p>` : ""}
          </div>
          <strong>${rupiah.format((item.price || 0) * (item.qty || 1))}</strong>
        </div>`).join("")}
    </section>`).join("");

  return `<article class="order-card" data-order-id="${escapeHtml(order.id)}">
    <div class="order-card-head">
      <div><span class="eyebrow">${escapeHtml(order.brand || "ORDER")}</span><h2>${escapeHtml(order.id)}</h2><p>${formatDate(order.created_at)}</p></div>
      <select class="status-select" data-status-order="${escapeHtml(order.id)}" aria-label="Status ${escapeHtml(order.id)}">
        ${["new", "processing", "completed", "cancelled"].map((status) => `<option value="${status}" ${order.status === status ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}
      </select>
    </div>
    <div class="order-summary">
      <div><span>Customer</span><strong>${escapeHtml(order.customer_name)}</strong></div>
      <div><span>Kontak</span><strong>${escapeHtml(contact || "-")}</strong></div>
      <div><span>Outlet</span><strong>${escapeHtml(order.customer_address)}</strong></div>
      <div><span>Total Bayar</span><strong>${rupiah.format(order.total || order.subtotal || 0)}</strong></div>
      ${order.company_name ? `<div><span>Perusahaan</span><strong>${escapeHtml(order.company_name)}</strong></div>` : ""}
      <div><span>Pickup</span><strong>${escapeHtml(order.pickup_time || "-")}</strong></div>
    </div>
    <div class="batch-list">${batchHtml}</div>
    <div class="order-actions">
      <button type="button" data-copy-order="${escapeHtml(order.id)}">Salin Format Order</button>
      ${order.payment_proof_url ? `<a href="${escapeHtml(order.payment_proof_url)}" target="_blank" rel="noopener">Lihat Bukti Bayar</a>` : ""}
    </div>
  </article>`;
}

function renderOrders() {
  renderMetrics();
  const filtered = orders.filter(orderMatches);
  ordersStatus.textContent = `${filtered.length} dari ${orders.length} pesanan ditampilkan.`;
  ordersList.innerHTML = filtered.length ? filtered.map(renderOrderCard).join("") : '<div class="empty-orders">Tidak ada pesanan yang cocok.</div>';
}

function buildAdminOrderText(order) {
  const batches = getOrderBatches(order);
  const officialTotal = Number(order.official_total)
    || batches.reduce((sum, batch) => sum + (Number(batch.officialTotal) || 0), 0);
  const inferredBrand = order.brand
    || ((order.items || []).every((item) => getCatalogKopkenItem(item)) ? "Kopi Kenangan" : "-");
  const lines = [
    "Halo admin kopi.fachrindah, ada pesanan *JASDOR* baru! 🚀",
    "",
    `*ID Order:* ${order.id}`,
    `*Brand:* ${inferredBrand}`,
    `*Nama:* ${order.customer_name}`,
    `*Lokasi Outlet:* ${order.customer_address}`,
    `*Jam Pickup:* ${order.pickup_time || "Sekarang"}`,
  ];
  if (inferredBrand === "Kopi Kenangan") {
    lines.push(`*Plastik Take Away:* ${order.takeaway_plastic_fee > 0 ? `Ya (+${rupiah.format(order.takeaway_plastic_fee)})` : "Tidak"}`);
  }
  lines.push("", "🛒 *DAFTAR PESANAN:*", "===================================");

  batches.forEach((batch, batchIndex) => {
    lines.push(`📦 *Order Batch ${batch.number || batchIndex + 1}*`);
    (batch.items || []).forEach((item, index) => {
      lines.push(formatItemForCopy(item, index), "");
    });
    lines.push(`*Total Batch ${batch.number || batchIndex + 1}: (~${rupiah.format(batch.officialTotal || 0)}~* *${rupiah.format(batch.sellingTotal || 0)})*`);
    if (batchIndex < batches.length - 1) lines.push("", "-----------------------------------", "");
  });
  lines.push(
    "===================================",
    `*Total Harga Asli Semua: ${rupiah.format(officialTotal)}*`,
    `*TOTAL BAYAR: ${rupiah.format(order.subtotal || 0)}*`,
    "*Catatan: Jika harga outlet berbeda, mohon konfirmasi selisihnya terlebih dahulu.*",
  );
  if (order.payment_proof_url) lines.push("", `*Bukti Transfer:* ${order.payment_proof_url}`);
  if (order.service_fee > 0) lines.push(`*Biaya Layanan: ${rupiah.format(order.service_fee)}*`);
  if (order.takeaway_plastic_fee > 0) lines.push(`*Biaya Plastik Take Away: ${rupiah.format(order.takeaway_plastic_fee)}*`);
  lines.push(`*TOTAL BAYAR: ${rupiah.format(order.total || order.subtotal || 0)}*`);
  return lines.join("\n");
}

async function loadOrders() {
  ordersStatus.textContent = "Memuat pesanan...";
  const { data, error } = await client.from(config.ordersTable).select("*").order("created_at", { ascending: false }).limit(100);
  if (error) {
    ordersStatus.textContent = error.message.includes("permission") ? "Akun ini tidak memiliki akses admin pesanan." : `Gagal memuat pesanan: ${error.message}`;
    orders = [];
  } else {
    orders = data || [];
  }
  renderOrders();
}

function subscribeToOrders() {
  if (ordersChannel) client.removeChannel(ordersChannel);
  ordersChannel = client.channel("admin-orders")
    .on("postgres_changes", { event: "*", schema: "public", table: config.ordersTable }, () => loadOrders())
    .subscribe();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  loginStatus.textContent = "Memeriksa akun...";
  const { error } = await client.auth.signInWithPassword({
    email: document.querySelector("#adminEmail").value.trim(),
    password: document.querySelector("#adminPassword").value,
  });
  if (error) {
    loginStatus.textContent = "Email atau password admin tidak sesuai.";
  } else {
    loginStatus.textContent = "";
    showAuthenticated(true);
    await loadOrders();
    subscribeToOrders();
  }
  button.disabled = false;
});

ordersList.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-status-order]");
  if (!select) return;
  select.disabled = true;
  const { error } = await client.from(config.ordersTable).update({ status: select.value, updated_at: new Date().toISOString() }).eq("id", select.dataset.statusOrder);
  if (error) {
    ordersStatus.textContent = `Status gagal diubah: ${error.message}`;
    await loadOrders();
  } else {
    const order = orders.find((item) => item.id === select.dataset.statusOrder);
    if (order) order.status = select.value;
    renderOrders();
  }
});

ordersList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy-order]");
  if (!button) return;
  const order = orders.find((item) => item.id === button.dataset.copyOrder);
  if (!order) return;
  await navigator.clipboard.writeText(buildAdminOrderText(order));
  button.textContent = "Tersalin";
  window.setTimeout(() => { button.textContent = "Salin Format Order"; }, 1400);
});

orderSearch.addEventListener("input", renderOrders);
statusFilter.addEventListener("change", renderOrders);
document.querySelector("#refreshOrders").addEventListener("click", loadOrders);
logoutButton.addEventListener("click", async () => {
  if (ordersChannel) client.removeChannel(ordersChannel);
  await client.auth.signOut();
  orders = [];
  showAuthenticated(false);
});

client.auth.getSession().then(async ({ data }) => {
  const authenticated = Boolean(data.session);
  showAuthenticated(authenticated);
  if (authenticated) {
    await loadOrders();
    subscribeToOrders();
  }
});
