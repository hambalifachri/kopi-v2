import { createHash, createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const configPath = join(root, ".env.kopken-sync");

function loadEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).flatMap((line) => {
    const value = line.trim();
    if (!value || value.startsWith("#") || !value.includes("=")) return [];
    const index = value.indexOf("=");
    return [[value.slice(0, index).trim(), value.slice(index + 1).trim()]];
  }));
}

function fail(message) {
  console.error(`\nGAGAL VSPHONE: ${message}`);
  process.exit(1);
}

const env = { ...process.env, ...loadEnv(configPath) };
const accessKey = env.VSPHONE_ACCESS_KEY_ID || "";
const secretKey = env.VSPHONE_SECRET_ACCESS_KEY || "";
const padCode = env.VSPHONE_PAD_CODE || "";
const fallbackSshCommand = env.VSPHONE_SSH_COMMAND || "";
const fallbackConnectionKey = env.VSPHONE_CONNECTION_KEY || "";
const fallbackAdbTarget = env.VSPHONE_ADB_TARGET || "";
const baseUrl = (env.VSPHONE_HOST || "https://api.vsphone.com").replace(/\/$/, "");
const adb = env.ADB_PATH || "C:\\Users\\fachr\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe";
const node = process.execPath;

if (!accessKey || !secretKey || !padCode) {
  fail("Isi VSPHONE_ACCESS_KEY_ID, VSPHONE_SECRET_ACCESS_KEY, dan VSPHONE_PAD_CODE di .env.kopken-sync.");
}

async function post(path, data, { ignoreBusy = false } = {}) {
  const body = JSON.stringify(data);
  const host = new URL(baseUrl).host;
  const contentType = "application/json;charset=UTF-8";
  const signedHeaders = "content-type;host;x-content-sha256;x-date";
  const xDate = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
  const shortDate = xDate.slice(0, 8);
  const bodyHash = createHash("sha256").update(body, "utf8").digest("hex");
  const canonical = `host:${host}\nx-date:${xDate}\ncontent-type:${contentType}\nsignedHeaders:${signedHeaders}\nx-content-sha256:${bodyHash}`;
  const scope = `${shortDate}/armcloud-paas/request`;
  const stringToSign = `HMAC-SHA256\n${xDate}\n${scope}\n${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
  const hmac = (key, value) => createHmac("sha256", key).update(value, "utf8").digest();
  const signingKey = hmac(hmac(hmac(Buffer.from(secretKey, "utf8"), shortDate), "armcloud-paas"), "request");
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(baseUrl + path, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "X-Date": xDate,
        "X-Host": host,
        Authorization: `HMAC-SHA256 Credential=${accessKey}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
      body,
    });
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch { throw new Error(`Respons API VSPhone tidak valid: ${text.slice(0, 200)}`); }
    if (response.ok && result.code === 200) return result.data;
    if (/system is busy|sistem sedang sibuk/i.test(result.msg || "")) {
      if (ignoreBusy) return null;
      if (attempt < 3) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500));
        continue;
      }
    }
    throw new Error(`${path}: ${result.msg || `API VSPhone mengembalikan ${response.status}`}`);
  }
}

function run(command, args, label, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8", windowsHide: true, stdio: "inherit", ...options,
  });
  if (result.status !== 0) fail(`${label} gagal.`);
}

console.log(`Menghubungkan VSPhone ${padCode}...`);
let connection;
let needsTunnel = true;
const connectedDevices = spawnSync(adb, ["devices"], { encoding: "utf8", windowsHide: true }).stdout || "";
if (fallbackAdbTarget && connectedDevices.includes(`${fallbackAdbTarget}\tdevice`)) {
  console.log(`Koneksi ADB VSPhone masih aktif di ${fallbackAdbTarget}.`);
  connection = { adb: `adb connect ${fallbackAdbTarget}` };
  needsTunnel = false;
} else {
  try {
    await post("/vsphone/api/padApi/openOnlineAdb", { padCodes: [padCode], openStatus: 1 }, { ignoreBusy: true });
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500));
    connection = await post("/vsphone/api/padApi/adb", { padCode, enable: true });
  } catch (error) {
    if (!fallbackSshCommand || !fallbackConnectionKey || !fallbackAdbTarget) fail(error.message);
    console.log("API ADB sedang sibuk; memakai koneksi Local debugging yang tersimpan.");
    connection = {
      command: fallbackSshCommand,
      key: fallbackConnectionKey,
      adb: `adb connect ${fallbackAdbTarget}`,
    };
  }
}
if (!connection?.adb || (needsTunnel && (!connection.command || !connection.key))) {
  fail("VSPhone belum memberikan informasi ADB lengkap. Pastikan perangkat sedang menyala.");
}

if (needsTunnel) {
  const ssh = connection.command.match(/ssh\s+.*?([^\s]+@[^\s]+)\s+-p\s+(\d+)\s+-L\s+([^\s]+)\s+-Nf/i);
  if (!ssh) fail("Format koneksi SSH VSPhone tidak dikenali.");
  const localPort = ssh[3].split(":")[0];
  const staleTarget = connection.adb.match(/adb\s+connect\s+([^\s]+)/i)?.[1];
  if (staleTarget) spawnSync(adb, ["disconnect", staleTarget], { encoding: "utf8", windowsHide: true });
  if (process.platform === "win32" && /^\d+$/.test(localPort)) {
    const cleanup = `$port='${localPort}'; Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'ssh.exe' -and $_.CommandLine -match ('-L\\s+' + $port + ':') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`;
    spawnSync("powershell.exe", ["-NoProfile", "-Command", cleanup], { encoding: "utf8", windowsHide: true });
  }
  const tunnel = spawn("ssh", [
    "-oHostKeyAlgorithms=+ssh-rsa",
    "-o", "StrictHostKeyChecking=accept-new",
    ssh[1], "-p", ssh[2], "-L", ssh[3], "-N",
  ], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      VSPHONE_CONNECTION_KEY: connection.key,
      SSH_ASKPASS: join(here, "vsphone-askpass.cmd"),
      SSH_ASKPASS_REQUIRE: "force",
      DISPLAY: "vsphone",
    },
  });
  tunnel.unref();
}

const adbTarget = connection.adb.match(/adb\s+connect\s+([^\s]+)/i)?.[1];
if (!adbTarget) fail("Alamat ADB VSPhone tidak ditemukan.");
let adbConnected = false;
for (let attempt = 0; attempt < 12; attempt++) {
  spawnSync(adb, ["connect", adbTarget], { encoding: "utf8", windowsHide: true });
  const devices = spawnSync(adb, ["devices"], { encoding: "utf8", windowsHide: true }).stdout || "";
  if (devices.includes(`${adbTarget}\tdevice`)) {
    adbConnected = true;
    break;
  }
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
}
if (!adbConnected) fail("Koneksi ADB VSPhone gagal setelah terowongan SSH dibuka.");

// ADB reverse hilang setiap koneksi cloud tersambung ulang. HTTP Toolkit Android
// memakai port ini, sehingga tanpa dipasang lagi VPN-nya membuat internet buntu.
spawnSync(adb, ["-s", adbTarget, "reverse", "tcp:8000", "tcp:8000"], {
  encoding: "utf8",
  windowsHide: true,
});

console.log(`VSPhone tersambung di ${adbTarget}. Memulai sinkron menu.\n`);
let syncStatus = 1;
do {
  const sync = spawnSync(node, [join(here, "sync.mjs"), ...process.argv.slice(2)], {
    cwd: root,
    env: { ...process.env, ...env, ADB_SERIAL: adbTarget },
    stdio: "inherit",
    windowsHide: true,
  });
  syncStatus = sync.status ?? 1;
  if (syncStatus === 75) {
    console.log("Sesi HTTP Toolkit selesai. Membuka sesi baru dalam 2 detik...\n");
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2000));
  }
} while (syncStatus === 75);
process.exitCode = syncStatus;
