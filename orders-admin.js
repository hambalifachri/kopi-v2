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
const scanExpenseProofButton = document.querySelector("#scanExpenseProof");
const expenseFormStatus = document.querySelector("#expenseFormStatus");
const expenseList = document.querySelector("#expenseList");
const expenseScanPreview = document.querySelector("#expenseScanPreview");
const expenseScanList = document.querySelector("#expenseScanList");
const cutoffForm = document.querySelector("#cutoffForm");
const cutoffAt = document.querySelector("#cutoffAt");
const cutoffBalance = document.querySelector("#cutoffBalance");
const cutoffStatus = document.querySelector("#cutoffStatus");
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
let scannedExpenses = [];

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

function classifyDanaExpense(description) {
  const normalized = String(description || "").toLowerCase();
  if (normalized.includes("kukusan") || normalized.includes("fachrindah")) return "refund";
  if (/kop.?kenangan|opi kenangan|kenangan 1320|tomoro|fore coffee|fore\b/.test(normalized)) return "outlet";
  return "other";
}

function parseExpenseAmount(value) {
  const text = String(value || "").replace(/\s+/g, "").replace(/^[-+]?Rp/i, "").replace(/,00$/, "");
  return Number(text.replace(/\D/g, ""));
}

function parseDanaHistoryText(text) {
  const monthNumbers = { jan: "01", feb: "02", mar: "03", apr: "04", mei: "05", jun: "06", jul: "07", agu: "08", aug: "08", ago: "08", ags: "08", sep: "09", okt: "10", nov: "11", des: "12" };
  const lines = String(text || "").split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const datePattern = /(\d{1,2})\s+(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Aug|Ago|Ags|Sep|Okt|Nov|Des)\s+(\d{4})\D{0,8}(\d{1,2})[:.](\d{2})/i;
  const amountPattern = /(?:-|–|—|−|“|”|"|')?\s*Rp\s*([\d.,]+)/i;
  const merchantPattern = /k?opi\s*kenangan|kukusan|ultramen|tomoro|fore\b/i;
  const dateIndexes = lines.map((line, index) => datePattern.test(line) ? index : -1).filter((index) => index >= 0);
  const parsed = [];

  dateIndexes.forEach((index, datePosition) => {
    const line = lines[index];
    const dateMatch = line.match(datePattern);
    const previousDateIndex = dateIndexes[datePosition - 1] ?? -1;
    const nextDateIndex = dateIndexes[datePosition + 1] ?? lines.length;
    const contextLines = lines.slice(previousDateIndex + 1, index);
    const transactionLines = lines.slice(index, nextDateIndex);
    const transactionLine = transactionLines.find((candidate) => amountPattern.test(candidate));
    if (!transactionLine) return;
    if (/\+\s*Rp/i.test(transactionLine) || /\+\s*Rp/i.test(line)) return;
    const amountMatch = transactionLine.match(amountPattern) || line.match(amountPattern);
    if (!amountMatch) return;

    const merchantLine = contextLines.reverse().find((candidate) => merchantPattern.test(candidate));
    let description = merchantLine || transactionLine.replace(amountPattern, "").trim();
    if (!description || datePattern.test(description)) description = [...contextLines, ...transactionLines].find((candidate) => !datePattern.test(candidate) && !amountPattern.test(candidate)) || "Transaksi DANA";
    description = description
      .replace(/^[^\p{L}\p{N}]+/u, "")
      .replace(/^(?:ome|oma|ou|we|oe|eu)\s+/i, "")
      .slice(0, 120) || "Transaksi DANA";
    const knownMerchantIndex = description.search(/k?opi\s*kenangan|kukusan|ultramen|tomoro|fore\b/i);
    if (knownMerchantIndex >= 0) description = description.slice(knownMerchantIndex);
    description = description
      .replace(/^opi\s*kenangan/i, "Kopi Kenangan")
      .replace(/^kopi\s*kenangan/i, "Kopi Kenangan")
      .replace(/^kukusan[.\s]+fachrindah/i, "Kukusan.Fachrindah")
      .replace(/^ultramen/i, "ULTRAMEN");
    if (/isi saldo dana|bulan ini/i.test(description)) return;
    const amount = parseExpenseAmount(amountMatch[1]);
    const [, day, month, year, hour, minute] = dateMatch;
    const spentAt = new Date(`${year}-${monthNumbers[month.toLowerCase()]}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${minute}:00+07:00`).toISOString();
    if (!amount || Number.isNaN(new Date(spentAt).getTime())) return;

    const key = `${spentAt}|${amount}`;
    if (parsed.some((item) => item.key === key)) return;
    parsed.push({ key, spentAt, amount, description, expenseType: classifyDanaExpense(description), selected: true });
  });
  return parsed;
}

function renderScannedExpenses() {
  expenseScanPreview.hidden = !scannedExpenses.length;
  expenseScanList.innerHTML = scannedExpenses.map((expense, index) => `<tr>
    <td><input type="checkbox" data-scan-selected="${index}" ${expense.selected ? "checked" : ""} aria-label="Simpan ${escapeHtml(expense.description)}"></td>
    <td>${escapeHtml(formatDate(expense.spentAt))}</td>
    <td><strong>${escapeHtml(expense.description)}</strong>${expense.sourceName ? `<small>${escapeHtml(expense.sourceName)}</small>` : ""}</td>
    <td><select data-scan-type="${index}" aria-label="Jenis ${escapeHtml(expense.description)}">
      <option value="outlet" ${expense.expenseType === "outlet" ? "selected" : ""}>Belanja Outlet</option>
      <option value="refund" ${expense.expenseType === "refund" ? "selected" : ""}>Refund Customer</option>
      <option value="other" ${expense.expenseType === "other" ? "selected" : ""}>Pengeluaran Lain</option>
    </select></td>
    <td><strong>${rupiah.format(expense.amount)}</strong></td>
  </tr>`).join("");
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Gambar gagal diproses.")),
    "image/png",
  ));
}

async function prepareDanaOcrSegments(file) {
  const bitmap = await createImageBitmap(file);
  const isLongScreenshot = bitmap.height > Math.max(2600, bitmap.width * 2.5);
  const sourceChunkHeight = isLongScreenshot ? Math.round(bitmap.width * 1.8) : bitmap.height;
  const sourceOverlap = isLongScreenshot ? Math.round(sourceChunkHeight * 0.1) : 0;
  const scale = Math.max(1, Math.min(2, 1400 / bitmap.width));
  const segments = [];

  for (let sourceY = 0, segmentNumber = 1; sourceY < bitmap.height; segmentNumber += 1) {
    const sourceHeight = Math.min(sourceChunkHeight, bitmap.height - sourceY);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(sourceHeight * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, sourceY, bitmap.width, sourceHeight, 0, 0, canvas.width, canvas.height);
    segments.push({ image: await canvasToBlob(canvas), segmentNumber, mode: "normal" });

    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < image.data.length; index += 4) {
      const gray = image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114;
      const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128));
      image.data[index] = contrast;
      image.data[index + 1] = contrast;
      image.data[index + 2] = contrast;
    }
    context.putImageData(image, 0, 0);
    segments.push({ image: await canvasToBlob(canvas), segmentNumber, mode: "tajam" });

    if (!isLongScreenshot || sourceY + sourceHeight >= bitmap.height) break;
    sourceY += sourceChunkHeight - sourceOverlap;
  }
  bitmap.close();
  return segments;
}

async function scanExpenseProof() {
  const proofFiles = [...(expenseProof.files || [])];
  if (!proofFiles.length) {
    expenseFormStatus.textContent = "Pilih screenshot histori DANA terlebih dahulu.";
    return;
  }
  if (proofFiles.length > 10) {
    expenseFormStatus.textContent = "Maksimal 10 screenshot untuk sekali proses.";
    return;
  }
  if (proofFiles.some((file) => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) {
    expenseFormStatus.textContent = "Setiap screenshot harus berupa gambar dengan ukuran maksimal 5 MB.";
    return;
  }
  if (!window.Tesseract) {
    expenseFormStatus.textContent = "Pembaca screenshot gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.";
    return;
  }

  scanExpenseProofButton.disabled = true;
  scanExpenseProofButton.textContent = "Membaca...";
  scannedExpenses = [];
  renderScannedExpenses();
  let worker = null;
  try {
    const preparedFiles = [];
    for (let fileIndex = 0; fileIndex < proofFiles.length; fileIndex += 1) {
      expenseFormStatus.textContent = `Menyiapkan screenshot ${fileIndex + 1}/${proofFiles.length}...`;
      preparedFiles.push({
        fileIndex,
        file: proofFiles[fileIndex],
        segments: await prepareDanaOcrSegments(proofFiles[fileIndex]),
      });
    }
    const totalSteps = preparedFiles.reduce((sum, prepared) => sum + prepared.segments.length, 0);
    let currentStep = 0;
    worker = await window.Tesseract.createWorker("eng", 1, {
      logger: ({ status, progress }) => {
        if (status === "recognizing text") {
          expenseFormStatus.textContent = `Membaca bagian ${currentStep + 1}/${totalSteps} (${Math.round(progress * 100)}%)...`;
        }
      },
    });
    const combined = [];
    for (const prepared of preparedFiles) {
      for (const segment of prepared.segments) {
        const result = await worker.recognize(segment.image);
        combined.push(...parseDanaHistoryText(result.data.text).map((expense) => ({
          ...expense,
          sourceFileIndex: prepared.fileIndex,
          sourceName: prepared.file.name,
        })));
        currentStep += 1;
      }
    }
    const transactionKey = (expense) => `${Math.floor(new Date(expense.spentAt || expense.spent_at).getTime() / 60000)}|${Number(expense.amount) || 0}`;
    const savedTransactionKeys = new Set(expenses.map(transactionKey));
    const uniqueTransactions = new Map();
    combined.forEach((expense) => {
      const key = transactionKey(expense);
      if (savedTransactionKeys.has(key)) return;
      const existing = uniqueTransactions.get(key);
      if (!existing || (existing.expenseType === "other" && expense.expenseType !== "other")) uniqueTransactions.set(key, expense);
    });
    scannedExpenses = [...uniqueTransactions.values()].sort((a, b) => new Date(b.spentAt) - new Date(a.spentAt));
    renderScannedExpenses();
    expenseFormStatus.textContent = scannedExpenses.length
      ? `${scannedExpenses.length} transaksi keluar terdeteksi. Periksa kategori lalu simpan.`
      : "Transaksi keluar tidak terbaca. Gunakan gambar yang jelas atau isi transaksi secara manual.";
  } catch (error) {
    expenseFormStatus.textContent = `Screenshot gagal dibaca: ${error.message}`;
  } finally {
    if (worker) await worker.terminate();
    scanExpenseProofButton.disabled = false;
    scanExpenseProofButton.textContent = "Baca Screenshot";
  }
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
const KOPKEN_BATCH_PREFERRED_MAX_TOTAL = 61000;
const KOPKEN_BATCH_MAX_TOTAL = 72000;

function getCatalogKopkenItem(item) {
  if (typeof MENU_ITEMS_DATA === "undefined") return null;
  return MENU_ITEMS_DATA.find((menuItem) => {
    const isKopken = !menuItem.brand || menuItem.brand === "kopi-kenangan";
    return isKopken && ((item.id && menuItem.id === item.id) || menuItem.name === item.name);
  }) || null;
}

function sortKopkenBatchItems(items) {
  if (typeof MENU_ITEMS_DATA === "undefined") return [...items];
  const brand = typeof BRANDS_DATA === "undefined" ? null : BRANDS_DATA.find((candidate) => candidate.id === "kopi-kenangan");
  const categoryIds = (brand?.categories || [])
    .map((category) => category.id)
    .filter((categoryId) => !String(categoryId).startsWith("promo-") && categoryId !== "baru");
  return items
    .map((item, originalIndex) => {
      const catalogItem = getCatalogKopkenItem(item);
      const catalogIndex = catalogItem ? MENU_ITEMS_DATA.indexOf(catalogItem) : Number.MAX_SAFE_INTEGER;
      const groups = Array.isArray(catalogItem?.group) ? catalogItem.group : [catalogItem?.group].filter(Boolean);
      const matchedCategory = categoryIds.findIndex((categoryId) => groups.includes(categoryId));
      return {
        item,
        originalIndex,
        categoryIndex: matchedCategory >= 0 ? matchedCategory : Number.MAX_SAFE_INTEGER,
        catalogIndex,
      };
    })
    .sort((first, second) => (
      first.categoryIndex - second.categoryIndex
      || first.catalogIndex - second.catalogIndex
      || first.originalIndex - second.originalIndex
    ))
    .map(({ item }) => item);
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
      ${sortKopkenBatchItems(batch.items || []).map((item) => `
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
    sortKopkenBatchItems(batch.items || []).forEach((item, index) => {
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
    if (data?.dana_cutoff_at) cutoffAt.value = new Date(new Date(data.dana_cutoff_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    if (data?.dana_opening_balance) cutoffBalance.value = String(data.dana_opening_balance);
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
  const amount = Math.round(parseExpenseAmount(expenseAmount.value));
  const proofFiles = [...(expenseProof.files || [])];
  const proofFile = proofFiles[0];
  const selectedScans = scannedExpenses.filter((expense) => expense.selected);
  if (!selectedScans.length && (!amount || amount < 1)) {
    expenseFormStatus.textContent = "Nominal pengeluaran belum benar.";
    return;
  }
  if (!selectedScans.length && !expenseDescription.value.trim()) {
    expenseFormStatus.textContent = "Keterangan pengeluaran belum diisi.";
    return;
  }
  if (proofFiles.some((file) => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) {
    expenseFormStatus.textContent = "Setiap screenshot harus berupa gambar dengan ukuran maksimal 5 MB.";
    return;
  }

  const button = document.querySelector("#saveExpense");
  const expenseId = crypto.randomUUID();
  const proofPaths = new Map();
  const uploadedProofPaths = [];
  button.disabled = true;
  button.textContent = "Menyimpan...";
  expenseFormStatus.textContent = "";

  try {
    const usedFileIndexes = selectedScans.length
      ? [...new Set(selectedScans.map((expense) => expense.sourceFileIndex).filter(Number.isInteger))]
      : (proofFile ? [0] : []);
    for (const fileIndex of usedFileIndexes) {
      const file = proofFiles[fileIndex];
      if (!file) continue;
      const proofPath = `dana-expenses/${expenseId}/${fileIndex + 1}-${Date.now()}-${normalizeExpenseFileName(file.name)}`;
      const { error: uploadError } = await client.storage.from(DANA_EXPENSE_PROOF_BUCKET).upload(proofPath, file, {
        cacheControl: "3600", contentType: file.type, upsert: false,
      });
      if (uploadError) throw uploadError;
      proofPaths.set(fileIndex, proofPath);
      uploadedProofPaths.push(proofPath);
    }

    const manualExpense = {
      id: expenseId,
      spent_at: new Date(`${expenseSpentAt.value}:00+07:00`).toISOString(),
      amount,
      expense_type: expenseType.value,
      description: expenseDescription.value.trim(),
      order_id: expenseOrderId.value.trim() || null,
      proof_path: proofPaths.get(0) || null,
      proof_url: null,
    };
    const rows = selectedScans.length ? selectedScans.map((expense) => ({
      id: crypto.randomUUID(),
      spent_at: expense.spentAt,
      amount: expense.amount,
      expense_type: expense.expenseType,
      description: expense.description,
      order_id: expenseOrderId.value.trim() || null,
      proof_path: proofPaths.get(expense.sourceFileIndex) || null,
      proof_url: null,
    })) : [manualExpense];
    const { error } = await client.from(DANA_EXPENSES_TABLE).insert(rows);
    if (error) throw error;

    expenseAmount.value = "";
    expenseType.value = "outlet";
    expenseDescription.value = "";
    expenseOrderId.value = "";
    expenseProof.value = "";
    scannedExpenses = [];
    renderScannedExpenses();
    await loadExpenses();
    expenseFormStatus.textContent = `${rows.length} pengeluaran DANA berhasil dicatat.`;
  } catch (error) {
    if (uploadedProofPaths.length) await client.storage.from(DANA_EXPENSE_PROOF_BUCKET).remove(uploadedProofPaths);
    expenseFormStatus.textContent = `Pengeluaran gagal disimpan: ${error.message}`;
  } finally {
    button.disabled = false;
    button.textContent = "Simpan Pengeluaran";
  }
}

async function saveFinanceCutoff(event) {
  event.preventDefault();
  const balance = Math.round(parseExpenseAmount(cutoffBalance.value));
  if (!cutoffAt.value || !Number.isFinite(balance) || balance < 0) {
    cutoffStatus.textContent = "Tanggal dan saldo cut-off belum benar.";
    return;
  }
  const button = cutoffForm.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Menyimpan...";
  try {
    const { data, error } = await client.from(FINANCE_SETTINGS_TABLE).upsert({
      id: 1,
      dana_opening_balance: balance,
      dana_cutoff_at: new Date(`${cutoffAt.value}:00+07:00`).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" }).select().single();
    if (error) throw error;
    financeSettings = data;
    renderAnalytics();
    cutoffStatus.textContent = `Cut-off saldo ${rupiah.format(balance)} berhasil disimpan.`;
  } catch (error) {
    cutoffStatus.textContent = `Cut-off saldo gagal disimpan: ${error.message}`;
  } finally {
    button.disabled = false;
    button.textContent = "Simpan Cut-off";
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
cutoffAt.value = `${currentAnalyticsDate}T${currentAnalyticsParts.hour}:${currentAnalyticsParts.minute}`;
document.querySelectorAll("[data-analytics-period]").forEach((button) => button.addEventListener("click", () => setAnalyticsPeriod(button.dataset.analyticsPeriod)));
[analyticsDay, analyticsMonth, analyticsYear].forEach((input) => input.addEventListener("change", renderAnalytics));
expenseForm.addEventListener("submit", saveDanaExpense);
cutoffForm.addEventListener("submit", saveFinanceCutoff);
scanExpenseProofButton.addEventListener("click", scanExpenseProof);
expenseProof.addEventListener("change", () => {
  scannedExpenses = [];
  renderScannedExpenses();
  const fileCount = expenseProof.files?.length || 0;
  expenseFormStatus.textContent = fileCount
    ? `${fileCount} screenshot dipilih. Klik Baca Screenshot untuk mendeteksi transaksi keluar.`
    : "";
});
expenseScanList.addEventListener("change", (event) => {
  const selectedIndex = event.target.dataset.scanSelected;
  const typeIndex = event.target.dataset.scanType;
  if (selectedIndex !== undefined) scannedExpenses[Number(selectedIndex)].selected = event.target.checked;
  if (typeIndex !== undefined) scannedExpenses[Number(typeIndex)].expenseType = event.target.value;
});
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
  const proofIsShared = expense.proof_path && expenses.some((item) => item.id !== expense.id && item.proof_path === expense.proof_path);
  if (expense.proof_path && !proofIsShared) await client.storage.from(DANA_EXPENSE_PROOF_BUCKET).remove([expense.proof_path]);
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
