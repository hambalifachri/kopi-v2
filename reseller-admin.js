const config = window.KOPI_SUPABASE_CONFIG;
const client = window.supabase.createClient(config.url, config.anonKey);
const loginPanel = document.querySelector("#loginPanel");
const generatorPanel = document.querySelector("#generatorPanel");
const logoutButton = document.querySelector("#logoutButton");
const loginForm = document.querySelector("#loginForm");
const resellerForm = document.querySelector("#resellerForm");
const loginStatus = document.querySelector("#loginStatus");
const generatorStatus = document.querySelector("#generatorStatus");
let latestReseller = null;

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

function showAuthenticated(authenticated) {
  loginPanel.hidden = authenticated;
  generatorPanel.hidden = !authenticated;
  logoutButton.hidden = !authenticated;
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
  if (error) loginStatus.textContent = "Email atau password admin tidak sesuai.";
  else { loginStatus.textContent = ""; showAuthenticated(true); }
  button.disabled = false;
});

resellerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = resellerForm.querySelector('button[type="submit"]');
  button.disabled = true;
  generatorStatus.textContent = "Membuat kode...";
  const name = document.querySelector("#resellerName").value.trim();
  const phone = normalizePhone(document.querySelector("#resellerPhone").value);
  const days = Number(document.querySelector("#membershipDays").value);
  const { data, error } = await client.rpc("admin_create_reseller", { p_name: name, p_phone: phone, p_days: days });
  const created = Array.isArray(data) ? data[0] : data;
  if (error || !created) {
    generatorStatus.textContent = error?.message || "Kode gagal dibuat. Pastikan akun ini terdaftar sebagai admin.";
  } else {
    latestReseller = { ...created, name, phone };
    generatorStatus.textContent = "";
    document.querySelector("#generatedCode").textContent = created.code;
    document.querySelector("#generatedDetails").textContent = `${name} · ${phone} · aktif sampai ${new Date(created.expires_at).toLocaleDateString("id-ID")}`;
    const message = `Halo ${name}, membership reseller kopi.fachrindah kamu sudah aktif.\n\nKode: *${created.code}*\nWhatsApp: ${phone}\nAktif sampai: ${new Date(created.expires_at).toLocaleDateString("id-ID")}\n\nKode hanya berlaku untuk menu satuan Kopi Kenangan.`;
    document.querySelector("#sendWhatsappButton").href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    document.querySelector("#resultPanel").hidden = false;
    resellerForm.reset();
  }
  button.disabled = false;
});

document.querySelector("#copyCodeButton").addEventListener("click", async () => {
  if (!latestReseller) return;
  await navigator.clipboard.writeText(latestReseller.code);
  document.querySelector("#copyCodeButton").textContent = "Tersalin";
});

logoutButton.addEventListener("click", async () => {
  await client.auth.signOut();
  showAuthenticated(false);
});

client.auth.getSession().then(({ data }) => showAuthenticated(Boolean(data.session)));
