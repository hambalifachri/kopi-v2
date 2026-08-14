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
const dateFilter = document.querySelector("#dateFilter");
const completeActiveOrdersButton = document.querySelector("#completeActiveOrders");
const ordersPagination = document.querySelector("#ordersPagination");
const ordersPageInfo = document.querySelector("#ordersPageInfo");
const previousOrdersPage = document.querySelector("#previousOrdersPage");
const nextOrdersPage = document.querySelector("#nextOrdersPage");
const ordersView = document.querySelector("#ordersView");
const analyticsView = document.querySelector("#analyticsView");
const analyticsMetrics = document.querySelector("#analyticsMetrics");
const analyticsPeriodLabel = document.querySelector("#analyticsPeriodLabel");
const analyticsDay = document.querySelector("#analyticsDay");
const analyticsMonth = document.querySelector("#analyticsMonth");
const analyticsYear = document.querySelector("#analyticsYear");
const salesTrend = document.querySelector("#salesTrend");
const trendSummary = document.querySelector("#trendSummary");
const brandRanking = document.querySelector("#brandRanking");
const customerRanking = document.querySelector("#customerRanking");
const menuRanking = document.querySelector("#menuRanking");
const adminPageTitle = document.querySelector("#adminPageTitle");
const expenseForm = document.querySelector("#expenseForm");
const expenseSpentAt = document.querySelector("#expenseSpentAt");
const expenseAmount = document.querySelector("#expenseAmount");
const expenseType = document.querySelector("#expenseType");
const expenseDescription = document.querySelector("#expenseDescription");
const expenseOrderId = document.querySelector("#expenseOrderId");
const expenseProof = document.querySelector("#expenseProof");
const expenseFormStatus = document.querySelector("#expenseFormStatus");
const expenseList = document.querySelector("#expenseList");
const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const ORDERS_FETCH_PAGE_SIZE = 1000;
const ORDERS_DISPLAY_PAGE_SIZE = 50;
const DANA_EXPENSES_TABLE = "dana_expenses";
const DANA_EXPENSE_PROOF_BUCKET = "dana-expense-proofs";
const FINANCE_SETTINGS_TABLE = "finance_settings";
let orders = [];
let expenses = [];
let financeSettings = null;
let ordersChannel = null;
let ordersRefreshTimer = null;
let currentOrdersPage = 1;
let analyticsPeriod = "all";

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

function formatOrderDay(value) {
  return new Date(value).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function localDateKey(value) {
  const date = new Date(value);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function getJakartaDateParts(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function jakartaDateKey(value) {
  const parts = getJakartaDateParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function effectiveOrderRevenue(order) {
  const total = Number(order.total);
  return total > 0 ? total : Number(order.subtotal) || 0;
}

function effectiveOrderOfficialTotal(order) {
  const savedTotal = Number(order.official_total);
  if (savedTotal > 0) return savedTotal;
  return (Array.isArray(order.items) ? order.items : []).reduce((sum, item) => {
    const unitPrice = Number(item.officialPrice) || Number(item.oldPrice) || Number(item.price) || 0;
    return sum + unitPrice * (Number(item.qty) || 1);
  }, 0);
}

function dateMatchesAnalyticsPeriod(value) {
  const dateKey = jakartaDateKey(value);
  if (analyticsPeriod === "day") return dateKey === analyticsDay.value;
  if (analyticsPeriod === "month") return dateKey.slice(0, 7) === analyticsMonth.value;
  if (analyticsPeriod === "year") return dateKey.slice(0, 4) === String(analyticsYear.value);
  return true;
}

function getAnalyticsFilterValue(order) {
  return dateMatchesAnalyticsPeriod(order.created_at);
}

function getAnalyticsOrders() {
  return orders.filter((order) => order.status !== "cancelled" && getAnalyticsFilterValue(order));
}

function getAnalyticsExpenses() {
  return expenses.filter((expense) => dateMatchesAnalyticsPeriod(expense.spent_at));
}

function getAnalyticsPeriodText(filteredOrders) {
  if (analyticsPeriod === "day") {
    return analyticsDay.value ? new Date(`${analyticsDay.value}T00:00:00`).toLocaleDateString("id-ID", { dateStyle: "full" }) : "Pilih tanggal";
  }
  if (analyticsPeriod === "month") {
    return analyticsMonth.value ? new Date(`${analyticsMonth.value}-01T00:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : "Pilih bulan";
  }
  if (analyticsPeriod === "year") return analyticsYear.value || "Pilih tahun";
  if (!filteredOrders.length) return "Semua waktu";
  const chronological = [...filteredOrders].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const first = new Date(chronological[0].created_at).toLocaleDateString("id-ID", { dateStyle: "medium" });
  const last = new Date(chronological.at(-1).created_at).toLocaleDateString("id-ID", { dateStyle: "medium" });
  return `${first} - ${last}`;
}

function analyticsMetric(label, value, detail = "", tone = "") {
  return `<div class="analytics-metric ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ""}</div>`;
}

function expenseTypeLabel(type) {
  return { outlet: "Belanja Outlet", refund: "Refund Customer", other: "Lainnya" }[type] || "Belanja Outlet";
}

function getOrderBrand(order) {
  return String(order.brand || order.items?.[0]?.brand || "Tidak diketahui").trim() || "Tidak diketahui";
}

function getTrendBucket(value) {
  const parts = getJakartaDateParts(value);
  if (analyticsPeriod === "day") return { key: parts.hour, label: `${parts.hour}.00` };
  if (analyticsPeriod === "month") return { key: `${parts.year}-${parts.month}-${parts.day}`, label: `${Number(parts.day)} ${new Date(`${parts.year}-${parts.month}-01T00:00:00`).toLocaleDateString("id-ID", { month: "short" })}` };
  return { key: `${parts.year}-${parts.month}`, label: new Date(`${parts.year}-${parts.month}-01T00:00:00`).toLocaleDateString("id-ID", { month: "short", year: "numeric" }) };
}

function renderAnalytics() {
  const filteredOrders = getAnalyticsOrders();
  const filteredExpenses = getAnalyticsExpenses();
  const revenue = filteredOrders.reduce((sum, order) => sum + effectiveOrderRevenue(order), 0);
  const danaExpenses = filteredExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  const refundTotal = filteredExpenses
    .filter((expense) => expense.expense_type === "refund")
    .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  const actualProfit = revenue - danaExpenses;
  const officialTotal = filteredOrders.reduce((sum, order) => sum + effectiveOrderOfficialTotal(order), 0);
  const estimatedCost = officialTotal / 2;
  const estimatedMargin = revenue - estimatedCost;
  const itemCount = filteredOrders.reduce((sum, order) => sum + (order.items || []).reduce((itemSum, item) => itemSum + (Number(item.qty) || 1), 0), 0);
  const averageOrder = filteredOrders.length ? revenue / filteredOrders.length : 0;
  const marginRate = revenue ? (estimatedMargin / revenue) * 100 : 0;
  const cutoffAt = financeSettings?.dana_cutoff_at ? new Date(financeSettings.dana_cutoff_at) : null;
  const openingBalance = Number(financeSettings?.dana_opening_balance) || 0;
  const incomeAfterCutoff = cutoffAt ? orders
    .filter((order) => order.status !== "cancelled" && new Date(order.created_at) > cutoffAt)
    .reduce((sum, order) => sum + effectiveOrderRevenue(order), 0) : 0;
  const expensesAfterCutoff = cutoffAt ? expenses
    .filter((expense) => new Date(expense.spent_at) > cutoffAt)
    .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0) : 0;
  const currentDanaBalance = openingBalance + incomeAfterCutoff - expensesAfterCutoff;
  const cutoffLabel = cutoffAt ? `Cut-off ${formatDate(cutoffAt)}` : "Cut-off belum diatur";

  analyticsPeriodLabel.textContent = getAnalyticsPeriodText(filteredOrders);
  analyticsMetrics.innerHTML = [
    analyticsMetric("Saldo DANA Sekarang", rupiah.format(currentDanaBalance), cutoffLabel, currentDanaBalance >= 0 ? "positive" : "negative"),
    analyticsMetric("Saldo Awal Cut-off", rupiah.format(openingBalance), cutoffLabel),
    analyticsMetric("Uang Masuk Web", rupiah.format(revenue), `${filteredOrders.length} order non-batal`),
    analyticsMetric("Uang Keluar DANA", rupiah.format(danaExpenses), `${filteredExpenses.length} transaksi dicatat`),
    analyticsMetric("Refund Customer", rupiah.format(refundTotal), "DANA ke QRIS Kukusan.Fachrindah"),
    analyticsMetric("Keuntungan Aktual", rupiah.format(actualProfit), "Uang masuk dikurangi pengeluaran DANA", actualProfit >= 0 ? "positive" : "negative"),
    analyticsMetric("Harga Normal / 2", rupiah.format(estimatedCost), "Estimasi modal"),
    analyticsMetric("Margin Keuntungan", rupiah.format(estimatedMargin), `${marginRate.toFixed(1)}% dari total bayar`, estimatedMargin >= 0 ? "positive" : "negative"),
    analyticsMetric("Total Harga Normal", rupiah.format(officialTotal), "Harga resmi outlet"),
    analyticsMetric("Menu Terjual", `${itemCount.toLocaleString("id-ID")} item`, "Total kuantitas"),
    analyticsMetric("Rata-rata Order", rupiah.format(averageOrder), "Per transaksi"),
  ].join("");

  expenseList.innerHTML = filteredExpenses.length ? filteredExpenses
    .sort((a, b) => new Date(b.spent_at) - new Date(a.spent_at))
    .map((expense) => `<tr><td>${escapeHtml(formatDate(expense.spent_at))}</td><td>${escapeHtml(expenseTypeLabel(expense.expense_type))}</td><td><strong>${escapeHtml(expense.description)}</strong></td><td>${escapeHtml(expense.order_id || "-")}</td><td>${expense.proof_url ? `<a href="${escapeHtml(expense.proof_url)}" target="_blank" rel="noopener">Lihat</a>` : "-"}</td><td><strong>${rupiah.format(expense.amount || 0)}</strong></td><td><button class="expense-delete" type="button" data-delete-expense="${escapeHtml(expense.id)}">Hapus</button></td></tr>`)
    .join("") : '<tr><td colspan="7" class="analytics-empty">Belum ada pengeluaran DANA pada periode ini.</td></tr>';

  const customers = new Map();
  filteredOrders.forEach((order) => {
    const phoneDigits = String(order.customer_phone || "").replace(/\D/g, "");
    const name = String(order.customer_name || "Tanpa nama").trim() || "Tanpa nama";
    const key = phoneDigits || `name:${name.toLowerCase()}`;
    const entry = customers.get(key) || { name, phone: phoneDigits || "-", orders: 0, revenue: 0 };
    entry.orders += 1;
    entry.revenue += effectiveOrderRevenue(order);
    customers.set(key, entry);
  });
  const topCustomers = [...customers.values()].sort((a, b) => b.orders - a.orders || b.revenue - a.revenue).slice(0, 10);
  customerRanking.innerHTML = topCustomers.length ? topCustomers.map((entry, index) => `<tr><td>${index + 1}</td><td><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.phone)}</small></td><td>${entry.orders}</td><td>${rupiah.format(entry.revenue)}</td></tr>`).join("") : '<tr><td colspan="4" class="analytics-empty">Belum ada data pelanggan.</td></tr>';

  const brands = new Map();
  filteredOrders.forEach((order) => {
    const brand = getOrderBrand(order);
    const entry = brands.get(brand) || { brand, orders: 0, qty: 0, revenue: 0 };
    entry.orders += 1;
    entry.qty += (order.items || []).reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
    entry.revenue += effectiveOrderRevenue(order);
    brands.set(brand, entry);
  });
  const topBrands = [...brands.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
  const maximumBrandQty = Math.max(1, ...topBrands.map((entry) => entry.qty));
  brandRanking.innerHTML = topBrands.length ? topBrands.map((entry) => `<div class="rank-row"><div class="rank-row-head"><strong>${escapeHtml(entry.brand)}</strong><span>${entry.qty.toLocaleString("id-ID")} item · ${entry.orders} order · ${rupiah.format(entry.revenue)}</span></div><div class="rank-track"><div class="rank-fill" style="width:${(entry.qty / maximumBrandQty) * 100}%"></div></div></div>`).join("") : '<div class="analytics-empty">Belum ada data brand.</div>';

  const menus = new Map();
  filteredOrders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const name = String(item.name || "Menu tanpa nama").trim();
      const brand = String(item.brand || getOrderBrand(order)).trim();
      const key = `${brand.toLowerCase()}|${name.toLowerCase()}`;
      const entry = menus.get(key) || { name, brand, qty: 0, revenue: 0 };
      const qty = Number(item.qty) || 1;
      entry.qty += qty;
      entry.revenue += (Number(item.price) || 0) * qty;
      menus.set(key, entry);
    });
  });
  const topMenus = [...menus.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 15);
  menuRanking.innerHTML = topMenus.length ? topMenus.map((entry, index) => `<tr><td>${index + 1}</td><td><strong>${escapeHtml(entry.name)}</strong></td><td>${escapeHtml(entry.brand)}</td><td>${entry.qty.toLocaleString("id-ID")}</td><td>${rupiah.format(entry.revenue)}</td></tr>`).join("") : '<tr><td colspan="5" class="analytics-empty">Belum ada data menu.</td></tr>';

  const trends = new Map();
  filteredOrders.forEach((order) => {
    const bucket = getTrendBucket(order.created_at);
    const entry = trends.get(bucket.key) || { ...bucket, orders: 0, revenue: 0, danaExpenses: 0 };
    entry.orders += 1;
    entry.revenue += effectiveOrderRevenue(order);
    trends.set(bucket.key, entry);
  });
  filteredExpenses.forEach((expense) => {
    const bucket = getTrendBucket(expense.spent_at);
    const entry = trends.get(bucket.key) || { ...bucket, orders: 0, revenue: 0, danaExpenses: 0 };
    entry.danaExpenses += Number(expense.amount) || 0;
    trends.set(bucket.key, entry);
  });
  const trendEntries = [...trends.values()].sort((a, b) => a.key.localeCompare(b.key));
  const maximumTrendRevenue = Math.max(1, ...trendEntries.map((entry) => entry.revenue));
  trendSummary.textContent = `${trendEntries.length} periode`;
  salesTrend.innerHTML = trendEntries.length ? trendEntries.map((entry) => {
    const actualProfit = entry.revenue - entry.danaExpenses;
    return `<div class="trend-row"><strong>${escapeHtml(entry.label)}</strong><div class="rank-track"><div class="rank-fill" style="width:${(entry.revenue / maximumTrendRevenue) * 100}%"></div></div><span><strong>${rupiah.format(entry.revenue)}</strong><small>${entry.orders} order · Aktual ${rupiah.format(actualProfit)}</small></span></div>`;
  }).join("") : '<div class="analytics-empty">Belum ada penjualan pada periode ini.</div>';
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
const KOPKEN_BATCH_PREFERRED_MAX_TOTAL = 62000;
const KOPKEN_BATCH_MAX_TOTAL = 72000;

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

function findValidBatchPartition(items, batchCount, maximumTotal) {
  const sortedItems = [...items].sort((a, b) => b.officialUnitPrice - a.officialUnitPrice);
  const buckets = Array.from({ length: batchCount }, () => []);
  const totals = Array(batchCount).fill(0);

  function assignItem(itemIndex) {
    if (itemIndex === sortedItems.length) {
      return totals.every((total) => total >= KOPKEN_BATCH_MIN_TOTAL && total <= maximumTotal);
    }
    const item = sortedItems[itemIndex];
    const attemptedTotals = new Set();
    const candidates = totals
      .map((total, index) => ({ total, index }))
      .filter(({ total }) => total + item.officialUnitPrice <= maximumTotal)
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
  const maximumBatchCount = Math.floor(total / KOPKEN_BATCH_MIN_TOTAL);
  let buckets = null;
  for (const maximumTotal of [KOPKEN_BATCH_PREFERRED_MAX_TOTAL, KOPKEN_BATCH_MAX_TOTAL]) {
    const minimumBatchCount = Math.max(1, Math.ceil(total / maximumTotal));
    for (let count = minimumBatchCount; count <= maximumBatchCount && !buckets; count += 1) {
      buckets = findValidBatchPartition(units, count, maximumTotal);
    }
    if (buckets) break;
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
  document.querySelector("#totalOrderCount").textContent = orders.length;
  document.querySelector("#newOrderCount").textContent = orders.filter((order) => order.status === "new").length;
  document.querySelector("#processingOrderCount").textContent = orders.filter((order) => order.status === "processing").length;
  document.querySelector("#completedOrderCount").textContent = orders.filter((order) => order.status === "completed").length;
}

function orderMatches(order) {
  const filter = statusFilter.value;
  if (filter !== "all" && order.status !== filter) return false;
  if (dateFilter.value && localDateKey(order.created_at) !== dateFilter.value) return false;
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
  const pageCount = Math.max(1, Math.ceil(filtered.length / ORDERS_DISPLAY_PAGE_SIZE));
  currentOrdersPage = Math.min(currentOrdersPage, pageCount);
  const pageStart = (currentOrdersPage - 1) * ORDERS_DISPLAY_PAGE_SIZE;
  const pageOrders = filtered.slice(pageStart, pageStart + ORDERS_DISPLAY_PAGE_SIZE);
  let lastDate = "";
  const orderHtml = pageOrders.map((order) => {
    const dateKey = localDateKey(order.created_at);
    const heading = dateKey === lastDate ? "" : `<h2 class="order-date-heading">${escapeHtml(formatOrderDay(order.created_at))}</h2>`;
    lastDate = dateKey;
    return `${heading}${renderOrderCard(order)}`;
  }).join("");

  ordersStatus.textContent = `${filtered.length} dari ${orders.length} pesanan ditemukan. Menampilkan ${pageOrders.length} pesanan di halaman ini.`;
  ordersList.innerHTML = filtered.length ? orderHtml : '<div class="empty-orders">Tidak ada pesanan yang cocok.</div>';
  ordersPagination.hidden = filtered.length <= ORDERS_DISPLAY_PAGE_SIZE;
  ordersPageInfo.textContent = `Halaman ${currentOrdersPage} / ${pageCount}`;
  previousOrdersPage.disabled = currentOrdersPage <= 1;
  nextOrdersPage.disabled = currentOrdersPage >= pageCount;
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
  ordersStatus.textContent = "Memuat seluruh riwayat pesanan...";
  const loadedOrders = [];
  let loadError = null;
  for (let from = 0; ; from += ORDERS_FETCH_PAGE_SIZE) {
    const { data, error } = await client.from(config.ordersTable)
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + ORDERS_FETCH_PAGE_SIZE - 1);
    if (error) {
      loadError = error;
      break;
    }
    loadedOrders.push(...(data || []));
    if (!data || data.length < ORDERS_FETCH_PAGE_SIZE) break;
    ordersStatus.textContent = `${loadedOrders.length} pesanan sudah dimuat...`;
  }
  if (loadError) {
    orders = [];
    renderOrders();
    renderAnalytics();
    ordersStatus.textContent = loadError.message.includes("permission") ? "Akun ini tidak memiliki akses admin pesanan." : `Gagal memuat pesanan: ${loadError.message}`;
    return;
  }
  orders = loadedOrders;
  renderOrders();
  renderAnalytics();
}

async function loadExpenses() {
  const loadedExpenses = [];
  for (let from = 0; ; from += ORDERS_FETCH_PAGE_SIZE) {
    const { data, error } = await client.from(DANA_EXPENSES_TABLE)
      .select("*")
      .order("spent_at", { ascending: false })
      .range(from, from + ORDERS_FETCH_PAGE_SIZE - 1);
    if (error) {
      expenses = [];
      expenseFormStatus.textContent = `Pengeluaran gagal dimuat: ${error.message}`;
      renderAnalytics();
      return;
    }
    loadedExpenses.push(...(data || []));
    if (!data || data.length < ORDERS_FETCH_PAGE_SIZE) break;
  }
  expenses = await Promise.all(loadedExpenses.map(async (expense) => {
    if (!expense.proof_path) return expense;
    const { data } = await client.storage.from(DANA_EXPENSE_PROOF_BUCKET).createSignedUrl(expense.proof_path, 3600);
    return { ...expense, proof_url: data?.signedUrl || "" };
  }));
  renderAnalytics();
}

async function loadFinanceSettings() {
  const { data, error } = await client.from(FINANCE_SETTINGS_TABLE).select("*").eq("id", 1).maybeSingle();
  if (error) {
    financeSettings = null;
    expenseFormStatus.textContent = `Saldo cut-off gagal dimuat: ${error.message}`;
  } else {
    financeSettings = data;
  }
  renderAnalytics();
}

async function loadAdminData() {
  await Promise.all([loadOrders(), loadExpenses(), loadFinanceSettings()]);
}

function normalizeExpenseFileName(name) {
  return String(name || "bukti-dana.jpg").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "bukti-dana.jpg";
}

async function saveDanaExpense(event) {
  event.preventDefault();
  const amount = Math.round(Number(expenseAmount.value));
  const proofFile = expenseProof.files?.[0];
  if (!amount || amount < 1) {
    expenseFormStatus.textContent = "Nominal pengeluaran belum benar.";
    return;
  }
  if (proofFile && (!proofFile.type.startsWith("image/") || proofFile.size > 5 * 1024 * 1024)) {
    expenseFormStatus.textContent = "Screenshot harus berupa gambar dengan ukuran maksimal 5 MB.";
    return;
  }

  const button = document.querySelector("#saveExpense");
  const expenseId = crypto.randomUUID();
  let proofPath = "";
  button.disabled = true;
  button.textContent = "Menyimpan...";
  expenseFormStatus.textContent = "";

  try {
    if (proofFile) {
      proofPath = `dana-expenses/${expenseId}/${Date.now()}-${normalizeExpenseFileName(proofFile.name)}`;
      const { error: uploadError } = await client.storage.from(DANA_EXPENSE_PROOF_BUCKET).upload(proofPath, proofFile, {
        cacheControl: "3600", contentType: proofFile.type, upsert: false,
      });
      if (uploadError) throw uploadError;
    }

    const spentAt = new Date(`${expenseSpentAt.value}:00+07:00`).toISOString();
    const { error } = await client.from(DANA_EXPENSES_TABLE).insert({
      id: expenseId,
      spent_at: spentAt,
      amount,
      expense_type: expenseType.value,
      description: expenseDescription.value.trim(),
      order_id: expenseOrderId.value.trim() || null,
      proof_path: proofPath || null,
      proof_url: null,
    });
    if (error) throw error;

    expenseAmount.value = "";
    expenseType.value = "outlet";
    expenseDescription.value = "";
    expenseOrderId.value = "";
    expenseProof.value = "";
    await loadExpenses();
    expenseFormStatus.textContent = "Pengeluaran DANA berhasil dicatat.";
  } catch (error) {
    if (proofPath) await client.storage.from(DANA_EXPENSE_PROOF_BUCKET).remove([proofPath]);
    expenseFormStatus.textContent = `Pengeluaran gagal disimpan: ${error.message}`;
  } finally {
    button.disabled = false;
    button.textContent = "Simpan Pengeluaran";
  }
}

async function completeActiveOrders() {
  const activeOrders = orders.filter((order) => order.status === "new" || order.status === "processing");
  if (!activeOrders.length) {
    ordersStatus.textContent = "Tidak ada order Baru atau Diproses yang perlu diselesaikan.";
    return;
  }
  if (!window.confirm(`Selesaikan ${activeOrders.length} order berstatus Baru dan Diproses?`)) return;

  completeActiveOrdersButton.disabled = true;
  completeActiveOrdersButton.textContent = "Menyelesaikan...";
  const { error } = await client.from(config.ordersTable)
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .in("status", ["new", "processing"]);
  if (error) {
    ordersStatus.textContent = `Order gagal diselesaikan: ${error.message}`;
  } else {
    await loadOrders();
    ordersStatus.textContent = `${activeOrders.length} order aktif berhasil diselesaikan.`;
  }
  completeActiveOrdersButton.disabled = false;
  completeActiveOrdersButton.textContent = "Selesaikan Semua Aktif";
}

function subscribeToOrders() {
  if (ordersChannel) client.removeChannel(ordersChannel);
  if (ordersRefreshTimer) window.clearInterval(ordersRefreshTimer);
  ordersChannel = client.channel("admin-orders")
    .on("postgres_changes", { event: "*", schema: "public", table: config.ordersTable }, () => loadOrders())
    .subscribe();
  ordersRefreshTimer = window.setInterval(() => {
    if (!document.hidden) loadAdminData();
  }, 10000);
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
    await loadAdminData();
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
    renderAnalytics();
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

orderSearch.addEventListener("input", () => { currentOrdersPage = 1; renderOrders(); });
statusFilter.addEventListener("change", () => { currentOrdersPage = 1; renderOrders(); });
dateFilter.addEventListener("change", () => { currentOrdersPage = 1; renderOrders(); });
document.querySelector("#refreshOrders").addEventListener("click", loadAdminData);
completeActiveOrdersButton.addEventListener("click", completeActiveOrders);
previousOrdersPage.addEventListener("click", () => { currentOrdersPage -= 1; renderOrders(); window.scrollTo({ top: 0, behavior: "smooth" }); });
nextOrdersPage.addEventListener("click", () => { currentOrdersPage += 1; renderOrders(); window.scrollTo({ top: 0, behavior: "smooth" }); });
document.querySelectorAll("[data-admin-view]").forEach((button) => {
  button.addEventListener("click", () => {
    const showAnalytics = button.dataset.adminView === "analytics";
    document.querySelectorAll("[data-admin-view]").forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    ordersView.hidden = showAnalytics;
    analyticsView.hidden = !showAnalytics;
    completeActiveOrdersButton.hidden = showAnalytics;
    adminPageTitle.textContent = showAnalytics ? "Analisis Bisnis" : "Pesanan Masuk";
    if (showAnalytics) renderAnalytics();
  });
});

function setAnalyticsPeriod(period) {
  analyticsPeriod = period;
  document.querySelectorAll("[data-analytics-period]").forEach((button) => button.classList.toggle("active", button.dataset.analyticsPeriod === period));
  document.querySelector("#analyticsDayField").hidden = period !== "day";
  document.querySelector("#analyticsMonthField").hidden = period !== "month";
  document.querySelector("#analyticsYearField").hidden = period !== "year";
  renderAnalytics();
}

const currentAnalyticsDate = jakartaDateKey(new Date());
const currentAnalyticsParts = getJakartaDateParts(new Date());
analyticsDay.value = currentAnalyticsDate;
analyticsMonth.value = currentAnalyticsDate.slice(0, 7);
analyticsYear.value = currentAnalyticsDate.slice(0, 4);
expenseSpentAt.value = `${currentAnalyticsDate}T${currentAnalyticsParts.hour}:${currentAnalyticsParts.minute}`;
document.querySelectorAll("[data-analytics-period]").forEach((button) => button.addEventListener("click", () => setAnalyticsPeriod(button.dataset.analyticsPeriod)));
[analyticsDay, analyticsMonth, analyticsYear].forEach((input) => input.addEventListener("change", renderAnalytics));
expenseForm.addEventListener("submit", saveDanaExpense);
expenseList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-expense]");
  if (!button) return;
  const expense = expenses.find((item) => item.id === button.dataset.deleteExpense);
  if (!expense || !window.confirm(`Hapus pengeluaran ${rupiah.format(expense.amount)}?`)) return;
  button.disabled = true;
  const { error } = await client.from(DANA_EXPENSES_TABLE).delete().eq("id", expense.id);
  if (error) {
    expenseFormStatus.textContent = `Pengeluaran gagal dihapus: ${error.message}`;
    button.disabled = false;
    return;
  }
  if (expense.proof_path) await client.storage.from(DANA_EXPENSE_PROOF_BUCKET).remove([expense.proof_path]);
  await loadExpenses();
  expenseFormStatus.textContent = "Pengeluaran berhasil dihapus.";
});
logoutButton.addEventListener("click", async () => {
  if (ordersChannel) client.removeChannel(ordersChannel);
  if (ordersRefreshTimer) window.clearInterval(ordersRefreshTimer);
  ordersRefreshTimer = null;
  await client.auth.signOut();
  orders = [];
  expenses = [];
  showAuthenticated(false);
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !ordersPanel.hidden) loadAdminData();
});

client.auth.getSession().then(async ({ data }) => {
  const authenticated = Boolean(data.session);
  showAuthenticated(authenticated);
  if (authenticated) {
    await loadAdminData();
    subscribeToOrders();
  }
});
