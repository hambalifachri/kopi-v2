import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDirectory = path.resolve(import.meta.dirname, "..");
const envPath = path.join(rootDirectory, ".env.local");
const outputDirectory = path.join(rootDirectory, "vsphone-output");

async function loadLocalEnv() {
  let content = "";
  try {
    content = await fs.readFile(envPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (!(key in process.env)) process.env[key] = value;
  }
}

await loadLocalEnv();

const config = {
  host: String(process.env.VSPHONE_HOST || "https://api.vsphone.com").replace(/\/$/, ""),
  accessKey: String(process.env.VSPHONE_ACCESS_KEY_ID || "").trim(),
  secretKey: String(process.env.VSPHONE_SECRET_ACCESS_KEY || "").trim(),
};
let resolvedAuthMode = "auto";

function validateConfig() {
  const missing = [];
  if (!config.accessKey) missing.push("VSPHONE_ACCESS_KEY_ID");
  if (!config.secretKey) missing.push("VSPHONE_SECRET_ACCESS_KEY");
  if (missing.length) {
    throw new Error(`Isi ${missing.join(" dan ")} di .env.local terlebih dahulu.`);
  }
}

function signRequest(timestamp, requestPath, body) {
  return crypto
    .createHash("sha256")
    .update(config.secretKey + timestamp + requestPath + body, "utf8")
    .digest("hex");
}

function hmac(key, content) {
  return crypto.createHmac("sha256", key).update(content, "utf8").digest();
}

function formatV4Date(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildV4Headers(body) {
  const host = new URL(config.host).host;
  const contentType = "application/json;charset=UTF-8";
  const signedHeaders = "content-type;host;x-content-sha256;x-date";
  const xDate = formatV4Date();
  const shortDate = xDate.slice(0, 8);
  const service = "armcloud-paas";
  const credentialScope = `${shortDate}/${service}/request`;
  const contentHash = crypto.createHash("sha256").update(body, "utf8").digest("hex");
  const canonicalRequest = [
    `host:${host}`,
    `x-date:${xDate}`,
    `content-type:${contentType}`,
    `signedHeaders:${signedHeaders}`,
    `x-content-sha256:${contentHash}`,
  ].join("\n");
  const canonicalHash = crypto.createHash("sha256").update(canonicalRequest, "utf8").digest("hex");
  const stringToSign = ["HMAC-SHA256", xDate, credentialScope, canonicalHash].join("\n");
  const dateKey = hmac(config.secretKey, shortDate);
  const serviceKey = hmac(dateKey, service);
  const signingKey = hmac(serviceKey, "request");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  return {
    "content-type": contentType,
    "x-date": xDate,
    "x-host": host,
    authorization: `HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

async function sendPost(requestPath, body, authMode) {
  let headers;
  if (authMode === "v4") {
    headers = buildV4Headers(body);
  } else {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    headers = {
      "X-Access-Key": config.accessKey,
      "X-Timestamp": timestamp,
      "X-Sign": signRequest(timestamp, requestPath, body),
      "Content-Type": "application/json",
    };
  }
  const response = await fetch(config.host + requestPath, {
    method: "POST",
    headers,
    body,
  });
  const responseText = await response.text();
  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(`VSPhone mengembalikan respons bukan JSON (${response.status}).`);
  }
  return { response, result };
}

async function post(requestPath, payload = {}) {
  validateConfig();
  const body = JSON.stringify(payload);
  const authModes = resolvedAuthMode === "auto" ? ["v2", "v4"] : [resolvedAuthMode];
  let latestFailure;
  for (const authMode of authModes) {
    const outcome = await sendPost(requestPath, body, authMode);
    if (outcome.response.ok && outcome.result.code === 200) {
      resolvedAuthMode = authMode;
      return outcome.result;
    }
    latestFailure = outcome;
    const requestsAuthorization = outcome.result.code === 2032 && /authorization/i.test(String(outcome.result.msg || ""));
    if (!(authMode === "v2" && requestsAuthorization)) break;
  }
  throw new Error(`VSPhone API gagal: ${latestFailure?.result.code || latestFailure?.response.status} ${latestFailure?.result.msg || "Unknown error"}`);
}

async function listDevices({ silent = false } = {}) {
  const result = await post("/vsphone/api/padApi/userPadList", {});
  const devices = Array.isArray(result.data) ? result.data : [];
  if (!silent) {
    if (!devices.length) {
      console.log("Tidak ada cloud phone pada akun ini.");
      return devices;
    }
    console.table(devices.map((device) => ({
      name: device.padName || "-",
      padCode: device.padCode || "-",
      status: device.cvmStatus === 100 ? "normal" : String(device.cvmStatus ?? "unknown"),
      android: device.androidVersion || "-",
      expires: device.signExpirationTime || "-",
    })));
  }
  return devices;
}

async function findTargetDevice(requestedPadCode) {
  const devices = await listDevices({ silent: true });
  const device = requestedPadCode
    ? devices.find((candidate) => candidate.padCode === requestedPadCode)
    : devices.find((candidate) => candidate.padName === "DEVICE-2") || devices[0];
  if (!device?.padCode) throw new Error("Device tujuan tidak ditemukan.");
  return device;
}

async function downloadPreviews(requestedPadCode) {
  const devices = await listDevices({ silent: true });
  const padCodes = requestedPadCode
    ? devices.filter((device) => device.padCode === requestedPadCode).map((device) => device.padCode)
    : devices.map((device) => device.padCode).filter(Boolean);
  if (!padCodes.length) throw new Error(requestedPadCode ? `Device ${requestedPadCode} tidak ditemukan.` : "Tidak ada device untuk diambil preview-nya.");

  const result = await post("/vsphone/api/padApi/getLongGenerateUrl", {
    padCodes,
    format: "png",
    width: "720",
    quality: 80,
  });
  await fs.mkdir(outputDirectory, { recursive: true });

  for (const preview of Array.isArray(result.data) ? result.data : []) {
    if (!preview.success || !preview.url) {
      console.warn(`${preview.padCode}: preview gagal (${preview.reason || "tanpa alasan"}).`);
      continue;
    }
    const imageResponse = await fetch(preview.url);
    if (!imageResponse.ok) {
      console.warn(`${preview.padCode}: gambar gagal diunduh (${imageResponse.status}).`);
      continue;
    }
    const outputPath = path.join(outputDirectory, `${preview.padCode}.png`);
    await fs.writeFile(outputPath, Buffer.from(await imageResponse.arrayBuffer()));
    console.log(`${preview.padCode}: ${outputPath}`);
  }
}

async function getInstalledApps(requestedPadCode) {
  const device = await findTargetDevice(requestedPadCode);
  const result = await post("/vsphone/api/padApi/listInstalledApp", { padCodes: [device.padCode] });
  const deviceApps = Array.isArray(result.data) ? result.data.find((item) => item.padCode === device.padCode) : null;
  const apps = Array.isArray(deviceApps?.apps) ? deviceApps.apps : [];
  return { device, apps };
}

async function listInstalledApps(requestedPadCode) {
  const { apps } = await getInstalledApps(requestedPadCode);
  console.table(apps.map((app) => ({ name: app.appName || "-", package: app.packageName || "-", version: app.versionName || "-" })));
}

async function waitForTask(taskId, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const result = await post("/vsphone/api/padApi/padTaskDetail", { taskIds: [taskId] });
    const task = Array.isArray(result.data) ? result.data.find((item) => Number(item.taskId) === Number(taskId)) : null;
    if (!task || [1, 2].includes(Number(task.taskStatus))) continue;
    if (Number(task.taskStatus) === 3) return task;
    const taskSummary = {
      taskId: task.taskId,
      taskStatus: task.taskStatus,
      taskResult: task.taskResult,
      errorMsg: task.errorMsg,
      endTime: task.endTime,
    };
    throw new Error(`Task VSPhone gagal: ${JSON.stringify(taskSummary)}`);
  }
  throw new Error(`Task VSPhone ${taskId} melewati batas waktu.`);
}

async function executeDeviceCommand(padCode, scriptContent) {
  const result = await post("/vsphone/api/padApi/asyncCmd", { padCodes: [padCode], scriptContent });
  const task = Array.isArray(result.data) ? result.data[0] : null;
  if (!task?.taskId) throw new Error("VSPhone tidak mengembalikan task ID.");
  return waitForTask(task.taskId);
}

async function inspectWebTargets(requestedPadCode) {
  const device = await findTargetDevice(requestedPadCode);
  const webTarget = await detectWebTargetPackage(device.padCode);
  console.log(webTarget.rawOutput || "Tidak ada package browser/webview/html viewer yang terdeteksi.");
}

async function diagnoseMockLaunch(requestedPadCode) {
  const device = await findTargetDevice(requestedPadCode);
  const remotePath = "/sdcard/Download/kopken-automation-lab.html";
  const commands = [
    "echo '[resolve html]';cmd package resolve-activity --brief -a android.intent.action.VIEW -d 'file:///sdcard/Download/kopken-automation-lab.html' -t 'text/html' || true",
    "echo '[resolve chrome]';cmd package resolve-activity --brief -a android.intent.action.VIEW -d 'file:///sdcard/Download/kopken-automation-lab.html' -t 'text/html' -p com.android.chrome || true",
    "echo '[htmlviewer activities]';dumpsys package com.android.htmlviewer | grep -E 'Activity|android.intent.action.VIEW|text/html' | head -40 || true",
    "echo '[chrome activities]';dumpsys package com.android.chrome | grep -E 'Activity|android.intent.action.VIEW|http|text/html' | head -40 || true",
    "echo '[local server tools]';which nc || true;toybox nc --help 2>&1 | head -10 || true;which busybox || true",
    "echo '[top activity]';dumpsys activity top | grep -E 'ACTIVITY|mResumedActivity|topResumedActivity' | head -20 || true",
    `echo '[file]';ls -l ${remotePath} || true`,
  ].join(";");
  const task = await executeDeviceCommand(device.padCode, commands);
  console.log(String(task.taskResult || task.errorMsg || "").trim() || "Diagnostik tidak mengembalikan output.");
}

async function inspectServerTools(requestedPadCode) {
  const device = await findTargetDevice(requestedPadCode);
  const task = await executeDeviceCommand(
    device.padCode,
    "echo '[which nc]';which nc || true;echo '[toybox nc]';toybox nc --help 2>&1 | head -20 || true;echo '[busybox]';which busybox || true"
  );
  console.log(String(task.taskResult || task.errorMsg || "").trim() || "Tidak ada output.");
}

async function tapDevice(requestedPadCode, x, y) {
  const device = await findTargetDevice(requestedPadCode);
  await tapPad(device.padCode, x, y);
}

async function runDeviceShell(requestedPadCode, command) {
  const device = await findTargetDevice(requestedPadCode);
  const task = await executeDeviceCommand(device.padCode, command);
  console.log(String(task.taskResult || task.errorMsg || "").trim() || "Perintah selesai tanpa output.");
}

async function tapPad(padCode, x, y) {
  const result = await post("/vsphone/api/padApi/simulateTouch", {
    padCodes: [padCode],
    width: 544,
    height: 2048,
    pointCount: 1,
    positions: [
      { actionType: 0, x: Number(x), y: Number(y), nextPositionWaitTime: 80 },
      { actionType: 1, x: Number(x), y: Number(y), nextPositionWaitTime: 20 },
    ],
  });
  const task = Array.isArray(result.data) ? result.data[0] : null;
  if (task?.taskId) await waitForTask(task.taskId);
}

async function inputDeviceText(requestedPadCode, text) {
  const device = await findTargetDevice(requestedPadCode);
  await inputPadText(device.padCode, text);
}

async function inputPadText(padCode, text) {
  const result = await post("/vsphone/api/padApi/inputText", {
    padCodes: [padCode],
    text: String(text || ""),
  });
  const task = Array.isArray(result.data) ? result.data[0] : null;
  if (task?.taskId) await waitForTask(task.taskId);
}

async function quickSearchOutlet(keyword) {
  const device = await findTargetDevice();
  await tapPad(device.padCode, 280, 185);
  await new Promise((resolve) => setTimeout(resolve, 700));
  await tapPad(device.padCode, 250, 255);
  await inputPadText(device.padCode, keyword);
  await tapPad(device.padCode, 510, 1835);
  await new Promise((resolve) => setTimeout(resolve, 2500));
  await tapPad(device.padCode, 250, 900);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await downloadPreviews(device.padCode);
  console.log(`Outlet "${keyword}" dipilih pada ${device.padName || device.padCode}.`);
}

async function dumpDeviceUi(requestedPadCode) {
  const device = await findTargetDevice(requestedPadCode);
  const task = await executeDeviceCommand(
    device.padCode,
    "uiautomator dump /sdcard/window.xml >/dev/null 2>&1; cat /sdcard/window.xml"
  );
  const xml = String(task.taskResult || task.errorMsg || "").trim();
  if (!xml) {
    console.log("Struktur layar tidak tersedia.");
    return;
  }
  const rows = [...xml.matchAll(/<node\b([^>]+)>/g)]
    .map((match) => {
      const attrs = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((entry) => [entry[1], entry[2]]));
      const label = attrs.text || attrs["content-desc"];
      if (!label && attrs.clickable !== "true") return null;
      return { label: label || "(tanpa label)", class: attrs.class || "", clickable: attrs.clickable === "true", bounds: attrs.bounds || "" };
    })
    .filter(Boolean);
  console.table(rows);
}

async function detectWebTargetPackage(padCode) {
  const task = await executeDeviceCommand(
    padCode,
    "pm list packages | grep -Ei 'chrome|browser|webview|htmlviewer' || true"
  );
  const output = String(task.taskResult || task.errorMsg || "").trim();
  const packages = output
    .split(/\r?\n/)
    .map((line) => line.replace(/^package:/, "").trim())
    .filter(Boolean);
  const preferredPackages = [
    "com.android.htmlviewer",
    "com.android.chrome",
    "com.google.android.apps.chrome",
    "com.android.browser",
  ];
  return {
    packageName: preferredPackages.find((packageName) => packages.includes(packageName)) || "",
    rawOutput: output,
  };
}

async function deployMock(requestedPadCode) {
  const device = await findTargetDevice(requestedPadCode);
  const webTarget = await detectWebTargetPackage(device.padCode);
  if (!webTarget.packageName) {
    throw new Error(
      `${device.padName || device.padCode} belum punya browser/web target. Pasang browser atau APK mock dulu, lalu jalankan npm run vsphone:mock lagi.`
    );
  }

  const mockHtml = await fs.readFile(path.join(rootDirectory, "kopken-mock.html"));
  const encodedHtml = mockHtml.toString("base64");
  const remotePath = "/sdcard/Download/kopken-automation-lab.html";
  console.log(`Mengirim mock ke ${device.padName || device.padCode}...`);
  const remoteBase64Path = `${remotePath}.b64`;
  const chunks = encodedHtml.match(/.{1,4000}/g) || [];
  await executeDeviceCommand(device.padCode, `mkdir -p /sdcard/Download;rm -f ${remoteBase64Path} ${remotePath}`);
  for (let index = 0; index < chunks.length; index += 1) {
    process.stdout.write(`Bagian ${index + 1}/${chunks.length}... `);
    await executeDeviceCommand(device.padCode, `echo -n '${chunks[index]}' >> ${remoteBase64Path}`);
    console.log("ok");
  }
  const browserPackage = webTarget.rawOutput.includes("package:com.android.chrome") ? "com.android.chrome" : webTarget.packageName;
  const openMockCommand = browserPackage === "com.android.chrome"
    ? "am start -n com.android.chrome/com.google.android.apps.chrome.Main -a android.intent.action.VIEW -d 'http://127.0.0.1:8787/'"
    : `am start -a android.intent.action.VIEW -d 'http://127.0.0.1:8787/' -p ${browserPackage}`;
  const serverCommand = [
    `base64 -d ${remoteBase64Path} > ${remotePath}`,
    `chmod 644 ${remotePath}`,
    `rm -f ${remoteBase64Path}`,
    `nohup sh -c 'while true; do { printf "HTTP/1.1 200 OK\\r\\nContent-Type: text/html\\r\\nCache-Control: no-store\\r\\nConnection: close\\r\\n\\r\\n"; cat ${remotePath}; } | nc -l -p 8787 -q 1; done' >/sdcard/Download/kopken-mock-server.log 2>&1 & sleep 1`,
    "am force-stop com.kopikenangan || true",
    "am force-stop com.android.chrome || true",
    openMockCommand,
  ].join(";");
  await executeDeviceCommand(device.padCode, serverCommand);
  console.log(`Mock terbuka pada ${device.padName || device.padCode} melalui http://127.0.0.1:8787/.`);
}

function printUsage() {
  console.log(`VSPhone connection tester

Perintah:
  npm run vsphone:doctor            Validasi konfigurasi lokal
  npm run vsphone:list              Tampilkan cloud phone
  npm run vsphone:preview           Unduh preview semua cloud phone
  npm run vsphone:preview -- PADCODE Unduh preview satu cloud phone
  npm run vsphone:apps              Daftar aplikasi pada DEVICE-2
  npm run vsphone:web-targets       Cek browser/web target pada DEVICE-2
  npm run vsphone:webtools          Cek tool server lokal pada DEVICE-2
  npm run vsphone:diag-mock         Diagnose pembukaan mock pada DEVICE-2
  npm run vsphone:tap -- X Y        Tap koordinat pada DEVICE-2
  npm run vsphone:text -- "TEXT"    Input teks pada DEVICE-2
  npm run vsphone:ui                 Baca struktur layar DEVICE-2
  npm run vsphone:outlet -- "NAMA"  Cari dan pilih outlet pada DEVICE-2
  npm run vsphone:shell -- "CMD"     Jalankan diagnostik shell DEVICE-2
  npm run vsphone:mock              Buka mock pada DEVICE-2
  npm run vsphone:mock -- PADCODE   Buka mock pada device tertentu`);
}

async function run() {
  const [command = "help", argument] = process.argv.slice(2);
  if (command === "doctor") {
    validateConfig();
    console.log(`Konfigurasi siap. Host: ${config.host}; Access Key dan Secret Key sudah terisi.`);
    return;
  }
  if (command === "list") {
    await listDevices();
    return;
  }
  if (command === "preview") {
    await downloadPreviews(argument);
    return;
  }
  if (command === "apps") {
    await listInstalledApps(argument);
    return;
  }
  if (command === "web-targets") {
    await inspectWebTargets(argument);
    return;
  }
  if (command === "diag-mock") {
    await diagnoseMockLaunch(argument);
    return;
  }
  if (command === "webtools") {
    await inspectServerTools(argument);
    return;
  }
  if (command === "tap") {
    await tapDevice(undefined, argument, process.argv[4]);
    return;
  }
  if (command === "text") {
    await inputDeviceText(undefined, argument);
    return;
  }
  if (command === "ui") {
    await dumpDeviceUi(argument);
    return;
  }
  if (command === "outlet") {
    if (!argument) throw new Error("Masukkan nama outlet.");
    await quickSearchOutlet(argument);
    return;
  }
  if (command === "shell") {
    if (!argument) throw new Error("Masukkan perintah shell.");
    await runDeviceShell(undefined, argument);
    return;
  }
  if (command === "mock") {
    await deployMock(argument);
    return;
  }
  printUsage();
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
