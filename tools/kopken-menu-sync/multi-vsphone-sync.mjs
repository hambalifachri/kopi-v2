import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const adb = "C:\\Users\\fachr\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe";
const askpass = join(here, "vsphone-askpass.cmd");
const setupOnly = process.argv.includes("--setup-only");
const newOnly = process.argv.includes("--baru");

function loadEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).flatMap((line) => {
    const value = line.trim();
    if (!value || value.startsWith("#") || !value.includes("=")) return [];
    const index = value.indexOf("=");
    return [[value.slice(0, index).trim(), value.slice(index + 1).trim()]];
  }));
}

const mainEnv = loadEnv(join(root, ".env.kopken-sync"));
const deviceEnv = loadEnv(join(root, ".env.kopken-devices"));
const devices = [];
for (let index = 1; index <= 3; index++) {
  devices.push({
    name: deviceEnv[`DEVICE_${index}_NAME`],
    ssh: deviceEnv[`DEVICE_${index}_SSH`],
    key: deviceEnv[`DEVICE_${index}_KEY`],
    adb: deviceEnv[`DEVICE_${index}_ADB`],
  });
}
if (devices.some((device) => !device.name || !device.ssh || !device.key || !device.adb)) {
  throw new Error("Konfigurasi tiga VSPhone belum lengkap.");
}

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function reconnectDevice(device) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = spawnSync(adb, ["devices"], { encoding: "utf8", windowsHide: true }).stdout || "";
    if (current.includes(`${device.adb}\tdevice`)) return true;
    spawnSync(adb, ["disconnect", device.adb], { encoding: "utf8", windowsHide: true, timeout: 5000 });
    spawnSync(adb, ["connect", device.adb], { encoding: "utf8", windowsHide: true, timeout: 5000 });
    await sleep(800);
  }
  return false;
}

async function connectDevice(device) {
  console.log(`[${device.name}] Menyambungkan ADB...`);
  const current = spawnSync(adb, ["devices"], { encoding: "utf8", windowsHide: true }).stdout || "";
  if (!current.includes(`${device.adb}\tdevice`)) {
    const ssh = device.ssh.match(/ssh\s+.*?([^\s]+@[^\s]+)\s+-p\s+(\d+)\s+-L\s+([^\s]+)\s+-Nf/i);
    if (!ssh) throw new Error(`${device.name}: format SSH tidak dikenali.`);
    const localPort = ssh[3].split(":")[0];
    spawnSync(adb, ["disconnect", device.adb], { encoding: "utf8", windowsHide: true });
    const cleanup = `$port='${localPort}'; Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'ssh.exe' -and $_.CommandLine -match ('-L\\s+' + $port + ':') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`;
    spawnSync("powershell.exe", ["-NoProfile", "-Command", cleanup], { encoding: "utf8", windowsHide: true });
    const tunnel = spawn("ssh", [
      "-oHostKeyAlgorithms=+ssh-rsa", "-o", "StrictHostKeyChecking=accept-new",
      ssh[1], "-p", ssh[2], "-L", ssh[3], "-N",
    ], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: {
        ...process.env,
        VSPHONE_CONNECTION_KEY: device.key,
        SSH_ASKPASS: askpass,
        SSH_ASKPASS_REQUIRE: "force",
        DISPLAY: "vsphone",
      },
    });
    tunnel.unref();
  }
  for (let attempt = 0; attempt < 12; attempt++) {
    spawnSync(adb, ["connect", device.adb], { encoding: "utf8", windowsHide: true });
    const current = spawnSync(adb, ["devices"], { encoding: "utf8", windowsHide: true }).stdout || "";
    if (current.includes(`${device.adb}\tdevice`)) {
      spawnSync(adb, ["-s", device.adb, "reverse", "tcp:8000", "tcp:8000"], { encoding: "utf8", windowsHide: true });
      console.log(`[${device.name}] ADB siap.`);
      return;
    }
    await sleep(500);
  }
  throw new Error(`${device.name}: ADB gagal tersambung.`);
}

function getHttpToolkitServer() {
  const command = "(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '--htk-server-auth-token=' } | Select-Object -First 1).CommandLine";
  const line = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], {
    encoding: "utf8", windowsHide: true,
  }).stdout || "";
  const token = line.match(/--htk-server-auth-token=([^\s]+)/)?.[1];
  const port = line.match(/--htk-server-port=(\d+)/)?.[1];
  if (!token || !port) throw new Error("HTTP Toolkit belum siap. Buka HTTP Toolkit terlebih dahulu.");
  return { token, port };
}

async function activateHttpToolkit(device) {
  console.log(`[${device.name}] Mengaktifkan HTTP Toolkit...`);
  const { token, port } = getHttpToolkitServer();
  const response = await fetch(`http://127.0.0.1:${port}/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: "https://app.httptoolkit.tech",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "query { config { certificateFingerprint } }" }),
    signal: AbortSignal.timeout(5000),
  });
  const result = await response.json();
  const certFingerprint = result.data?.config?.certificateFingerprint;
  if (!response.ok || !certFingerprint) throw new Error(`${device.name}: konfigurasi HTTP Toolkit tidak terbaca.`);

  const setup = {
    addresses: ["10.0.2.2", "10.0.3.2", "127.0.0.1"],
    port: 8000,
    localTunnelPort: 8000,
    enableSocks: false,
    certFingerprint,
  };
  const intentData = Buffer.from(JSON.stringify(setup), "utf8").toString("base64")
    .replaceAll("+", "-").replaceAll("/", "_");
  spawnSync(adb, ["-s", device.adb, "reverse", "tcp:8000", "tcp:8000"], { encoding: "utf8", windowsHide: true });
  spawnSync(adb, ["-s", device.adb, "shell", "am", "start", "-n", "tech.httptoolkit.android.v1/tech.httptoolkit.android.MainActivity"], {
    encoding: "utf8", windowsHide: true, timeout: 8000,
  });
  await sleep(300);
  const activated = spawnSync(adb, ["-s", device.adb, "shell", "am", "start", "-W",
    "-a", "tech.httptoolkit.android.ACTIVATE",
    "-d", `https://android.httptoolkit.tech/connect/?data=${intentData}`,
  ], { encoding: "utf8", windowsHide: true, timeout: 10000 });
  if (activated.status !== 0) throw new Error(`${device.name}: intent VPN HTTP Toolkit gagal.`);
  await sleep(1500);
  await reconnectDevice(device);
  // Android 13 dapat menahan aktivasi pertama pada dialog izin notifikasi.
  const dumpPath = "/sdcard/kopken-htk-permission.xml";
  spawnSync(adb, ["-s", device.adb, "shell", "uiautomator", "dump", dumpPath], { encoding: "utf8", windowsHide: true });
  const hierarchy = spawnSync(adb, ["-s", device.adb, "shell", "cat", dumpPath], { encoding: "utf8", windowsHide: true }).stdout || "";
  if (/permission_allow_button/.test(hierarchy)) {
    spawnSync(adb, ["-s", device.adb, "shell", "input", "tap", "540", "1040"], { encoding: "utf8", windowsHide: true });
    await sleep(1000);
  }
  spawnSync(adb, ["-s", device.adb, "shell", "cmd", "appops", "set", "tech.httptoolkit.android.v1", "ACTIVATE_VPN", "allow"], {
    encoding: "utf8", windowsHide: true,
  });
  let vpnActive = false;
  for (let attempt = 0; attempt < 3 && !vpnActive; attempt++) {
    await reconnectDevice(device);
    const connectivity = spawnSync(adb, ["-s", device.adb, "shell", "dumpsys", "connectivity"], {
      encoding: "utf8", windowsHide: true, timeout: 8000,
    }).stdout || "";
    vpnActive = /type:\s*VPN/i.test(connectivity);
    if (!vpnActive) await sleep(1000);
  }
  if (!vpnActive) {
    const dumpPath = "/sdcard/kopken-htk-status.xml";
    spawnSync(adb, ["-s", device.adb, "shell", "uiautomator", "dump", dumpPath], {
      encoding: "utf8", windowsHide: true, timeout: 8000,
    });
    const hierarchy = spawnSync(adb, ["-s", device.adb, "shell", "cat", dumpPath], {
      encoding: "utf8", windowsHide: true, timeout: 5000,
    }).stdout || "";
    vpnActive = /text="Connected"|text="Disconnect"/i.test(hierarchy);
  }
  if (!vpnActive) {
    throw new Error(`${device.name}: VPN HTTP Toolkit tidak aktif.`);
  }
  spawnSync(adb, ["-s", device.adb, "reverse", "tcp:8000", "tcp:8000"], { encoding: "utf8", windowsHide: true });
  spawnSync(adb, ["-s", device.adb, "shell", "am", "start", "-n", "com.kopikenangan/.heart"], {
    encoding: "utf8", windowsHide: true,
  });
  await sleep(500);
  console.log(`[${device.name}] HTTP Toolkit siap.`);
}

async function runWorkerSession(device, index) {
  return new Promise((resolvePromise) => {
      const child = spawn(process.execPath, [
        join(here, "sync.mjs"), ...(newOnly ? [] : ["--ulang"]),
        `--worker-index=${index}`, `--worker-count=${devices.length}`,
      ], {
        cwd: root,
        env: { ...process.env, ...mainEnv, ADB_SERIAL: device.adb, SYNC_WORKER_ID: device.name, KOPKEN_MCP_BROKER_PORT: "47831" },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const relay = (stream) => stream.on("data", (chunk) => {
        for (const line of chunk.toString().split(/\r?\n/)) if (line) console.log(`[${device.name}] ${line}`);
      });
      relay(child.stdout);
      relay(child.stderr);
      child.on("exit", (code) => resolvePromise(code ?? 1));
  });
}

function stopInterception(device) {
  spawnSync(adb, ["-s", device.adb, "shell", "am", "start", "-W", "-a", "tech.httptoolkit.android.DEACTIVATE"], {
    encoding: "utf8", windowsHide: true, timeout: 5000,
  });
  spawnSync(adb, ["-s", device.adb, "shell", "am", "force-stop", "tech.httptoolkit.android.v1"], {
    encoding: "utf8", windowsHide: true,
  });
}

function internetReady(device) {
  const result = spawnSync(adb, ["-s", device.adb, "shell", "ping", "-c", "1", "-W", "3", "1.1.1.1"], {
    encoding: "utf8", windowsHide: true, timeout: 6000,
  });
  return result.status === 0;
}

async function restoreInternet(device) {
  await reconnectDevice(device);
  stopInterception(device);
  await sleep(1500);
  await reconnectDevice(device);
  let ready = false;
  for (let attempt = 0; attempt < 3 && !ready; attempt++) {
    ready = internetReady(device);
    if (!ready) await sleep(1000);
  }
  console.log(`[${device.name}] VPN dihentikan; internet ${ready ? "aman" : "belum pulih"}.`);
}

async function startBroker() {
  const broker = spawn(process.execPath, [join(here, "mcp-broker.mjs")], {
    cwd: root,
    env: { ...process.env, ...mainEnv, KOPKEN_MCP_BROKER_PORT: "47831" },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error("Broker HTTP Toolkit tidak siap.")), 30000);
    broker.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("READY")) { clearTimeout(timer); resolvePromise(); }
    });
    broker.stderr.on("data", (chunk) => console.log(`[HTTP Toolkit] ${chunk.toString().trim()}`));
    broker.once("exit", () => reject(new Error("Broker HTTP Toolkit berhenti saat mulai.")));
  });
  return broker;
}

console.log("Menghubungkan 3 VSPhone (perangkat menu tidak dipakai)...");
await Promise.all(devices.map(connectDevice));
if (setupOnly) {
  for (const device of devices) {
    await restoreInternet(device);
    if (!internetReady(device)) throw new Error(`${device.name}: internet tidak tersedia.`);
  }
  console.log("SETUP BERHASIL: tiga VSPhone tersambung dan internet aman.");
  process.exit(0);
}
console.log(`Semua VSPhone tersambung. Menyiapkan tiga perangkat paralel mode ${newOnly ? "outlet baru" : "sinkron ulang"}.\n`);
for (const device of devices) {
  await activateHttpToolkit(device);
  if (!internetReady(device)) {
    await restoreInternet(device);
    throw new Error(`${device.name}: internet tidak aman setelah HTTP Toolkit aktif.`);
  }
}
const broker = await startBroker();
console.log("Tiga perangkat mulai mencari outlet secara bersamaan.\n");
const statuses = await Promise.all(devices.map((device, index) => runWorkerSession(device, index)));
broker.kill();
for (const device of devices) await restoreInternet(device);
if (statuses.some((status) => status === 76)) process.exit(0);
process.exitCode = statuses.some((status) => status !== 0 && status !== 2) ? 1 : 0;
console.log("Semua pembagian outlet selesai diproses.");
