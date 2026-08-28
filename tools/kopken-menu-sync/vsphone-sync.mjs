import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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
const baseUrl = (env.VSPHONE_HOST || "https://api.vsphone.com").replace(/\/$/, "");
const adb = env.ADB_PATH || "C:\\Users\\fachr\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe";
const node = process.execPath;

if (!accessKey || !secretKey || !padCode) {
  fail("Isi VSPHONE_ACCESS_KEY_ID, VSPHONE_SECRET_ACCESS_KEY, dan VSPHONE_PAD_CODE di .env.kopken-sync.");
}

async function post(path, data) {
  const body = JSON.stringify(data);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHash("sha256").update(secretKey + timestamp + path + body, "utf8").digest("hex");
  const response = await fetch(baseUrl + path, {
    method: "POST",
    headers: {
      "X-Access-Key": accessKey,
      "X-Timestamp": timestamp,
      "X-Sign": signature,
      "Content-Type": "application/json",
    },
    body,
  });
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); } catch { fail(`Respons API VSPhone tidak valid: ${text.slice(0, 200)}`); }
  if (!response.ok || result.code !== 200) fail(result.msg || `API VSPhone mengembalikan ${response.status}`);
  return result.data;
}

function run(command, args, label) {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true, stdio: "inherit" });
  if (result.status !== 0) fail(`${label} gagal.`);
}

console.log(`Menghubungkan VSPhone ${padCode}...`);
const connection = await post("/vsphone/api/padApi/adb", { padCode, enable: true });
if (!connection?.command || !connection?.adb) fail("VSPhone belum memberikan informasi ADB lengkap. Pastikan perangkat sedang menyala.");

const ssh = connection.command.match(/ssh\s+.*?([^\s]+@[^\s]+)\s+-p\s+(\d+)\s+-L\s+([^\s]+)\s+-Nf/i);
if (!ssh) fail("Format koneksi SSH VSPhone tidak dikenali.");
run("ssh", [
  "-oHostKeyAlgorithms=+ssh-rsa",
  "-o", "StrictHostKeyChecking=accept-new",
  ssh[1], "-p", ssh[2], "-L", ssh[3], "-Nf",
], "Terowongan SSH VSPhone");

const adbTarget = connection.adb.match(/adb\s+connect\s+([^\s]+)/i)?.[1];
if (!adbTarget) fail("Alamat ADB VSPhone tidak ditemukan.");
run(adb, ["connect", adbTarget], "Koneksi ADB VSPhone");

console.log(`VSPhone tersambung di ${adbTarget}. Memulai sinkron menu.\n`);
const sync = spawnSync(node, [join(here, "sync.mjs"), ...process.argv.slice(2)], {
  cwd: root,
  env: { ...process.env, ...env, ADB_SERIAL: adbTarget },
  stdio: "inherit",
  windowsHide: true,
});
process.exitCode = sync.status ?? 1;
