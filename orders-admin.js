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

function getOrderBatches(order) {
  if (Array.isArray(order.batches) && order.batches.length) return order.batches;
  const items = Array.isArray(order.items) ? order.items : [];
  return [{ number: 1, officialTotal: order.official_total || 0, sellingTotal: order.subtotal || 0, items }];
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
  const contact = order.contact_method === "email" ? `Email: ${order.customer_email}` : `WhatsApp: ${order.customer_phone}`;
  const lines = [
    `ORDER ${order.id}`,
    `Brand: ${order.brand || "-"}`,
    `Customer: ${order.customer_name}`,
    `Kontak: ${contact}`,
    `Outlet: ${order.customer_address}`,
    `Pickup: ${order.pickup_time || "-"}`,
  ];
  if (order.company_name) lines.push(`Reimburse: ${order.company_name}${order.company_division ? ` / ${order.company_division}` : ""}`);
  lines.push("");
  getOrderBatches(order).forEach((batch) => {
    lines.push(`BATCH ${batch.number} (Outlet ${rupiah.format(batch.officialTotal || 0)} | Bayar ${rupiah.format(batch.sellingTotal || 0)})`);
    (batch.items || []).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.qty}x ${item.name} - ${rupiah.format((item.price || 0) * (item.qty || 1))}`);
      const options = formatOptions(item.options);
      if (options) lines.push(`   ${options}`);
      if (item.note) lines.push(`   Catatan: ${item.note}`);
    });
    lines.push("");
  });
  lines.push(`Total harga outlet: ${rupiah.format(order.official_total || 0)}`);
  lines.push(`TOTAL BAYAR: ${rupiah.format(order.total || order.subtotal || 0)}`);
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
