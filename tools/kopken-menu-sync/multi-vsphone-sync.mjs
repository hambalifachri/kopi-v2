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
const devices = [{
  name: "menu",
  ssh: mainEnv.VSPHONE_SSH_COMMAND,
  key: mainEnv.VSPHONE_CONNECTION_KEY,
  adb: mainEnv.VSPHONE_ADB_TARGET,
}];
for (let index = 1; index <= 3; index++) {
  devices.push({
    name: deviceEnv[`DEVICE_${index}_NAME`],
    ssh: deviceEnv[`DEVICE_${index}_SSH`],
    key: deviceEnv[`DEVICE_${index}_KEY`],
    adb: deviceEnv[`DEVICE_${index}_ADB`],
  });
}
if (devices.some((device) => !device.name || !device.ssh || !device.key || !device.adb)) {
  throw new Error("Konfigurasi empat VSPhone belum lengkap.");
}

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function connectDevice(device) {
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
  const { token, port } = getHttpToolkitServer();
  const query = "mutation($id: ID!, $port: Int!, $options: Json) { activateInterceptor(id:$id, proxyPort:$port, options:$options) }";
  const request = () => fetch(`http://127.0.0.1:${port}/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: "https://app.httptoolkit.tech",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
      query,
      variables: {
        id: "android-adb",
        port: 8000,
        options: { deviceId: device.adb, enableSocks: false },
      },
    }),
  });
  const response = await request();
  const result = await response.json();
  if (!response.ok || result.errors || result.data?.activateInterceptor?.success !== true) {
    throw new Error(`${device.name}: aktivasi HTTP Toolkit gagal.`);
  }
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
  const connectivity = spawnSync(adb, ["-s", device.adb, "shell", "dumpsys", "connectivity"], {
    encoding: "utf8", windowsHide: true,
  }).stdout || "";
  if (!/type:\s*VPN/i.test(connectivity)) {
    const retry = await request();
    const retryResult = await retry.json();
    if (!retry.ok || retryResult.errors || retryResult.data?.activateInterceptor?.success !== true) {
      throw new Error(`${device.name}: aktivasi ulang VPN HTTP Toolkit gagal.`);
    }
    await sleep(1000);
  }
  spawnSync(adb, ["-s", device.adb, "reverse", "tcp:8000", "tcp:8000"], { encoding: "utf8", windowsHide: true });
}

async function runWorker(device, index) {
  await sleep(index * 1500);
  let status = 75;
  while (status === 75) {
    status = await new Promise((resolvePromise) => {
      const child = spawn(process.execPath, [
        join(here, "sync.mjs"), ...(newOnly ? [] : ["--ulang"]),
        `--worker-index=${index}`, `--worker-count=${devices.length}`,
      ], {
        cwd: root,
        env: { ...process.env, ...mainEnv, ADB_SERIAL: device.adb, SYNC_WORKER_ID: device.name },
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
    if (status === 75) {
      console.log(`[${device.name}] Membuka sesi HTTP Toolkit baru...`);
      await sleep(2000);
    }
  }
  return status;
}

console.log("Menghubungkan 4 VSPhone...");
await Promise.all(devices.map(connectDevice));
console.log("Mengaktifkan HTTP Toolkit pada semua perangkat...");
for (const device of devices) await activateHttpToolkit(device);
if (setupOnly) {
  console.log("SETUP BERHASIL: empat VSPhone dan HTTP Toolkit siap.");
  process.exit(0);
}
console.log(`Semua VSPhone tersambung. Memulai empat worker mode ${newOnly ? "outlet baru" : "sinkron ulang"}.\n`);
const statuses = await Promise.all(devices.map(runWorker));
process.exitCode = statuses.some((status) => status !== 0 && status !== 2) ? 1 : 0;
