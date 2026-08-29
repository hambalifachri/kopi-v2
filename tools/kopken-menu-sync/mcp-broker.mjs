import { spawn } from "node:child_process";
import { createServer } from "node:net";

const command = process.env.HTTP_TOOLKIT_MCP;
const port = Number(process.env.KOPKEN_MCP_BROKER_PORT || 47831);
const callLimit = Number(process.env.HTTP_TOOLKIT_SESSION_CALL_LIMIT || 80);
let client;
let queue = Promise.resolve();

class McpClient {
  constructor() {
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = "";
    this.calls = 0;
  }

  async start() {
    this.proc = spawn(`\"${command}\"`, [], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true, shell: true });
    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk) => this.read(chunk));
    this.proc.on("exit", () => {
      for (const pending of this.pending.values()) pending.reject(new Error("HTTP Toolkit MCP berhenti."));
      this.pending.clear();
    });
    await this.request("initialize", {
      protocolVersion: "2024-11-05", capabilities: {},
      clientInfo: { name: "kopken-menu-broker", version: "1.0.0" },
    });
    this.proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} })}\n`);
  }

  read(chunk) {
    this.buffer += chunk;
    while (this.buffer.includes("\n")) {
      const split = this.buffer.indexOf("\n");
      const line = this.buffer.slice(0, split).trim();
      this.buffer = this.buffer.slice(split + 1);
      if (!line.startsWith("{")) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      const pending = this.pending.get(message.id);
      if (!pending) continue;
      this.pending.delete(message.id);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    }
  }

  request(method, params) {
    const id = this.nextId++;
    this.proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Timeout HTTP Toolkit: ${method}`)); }, 60000);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
    });
  }

  close() { this.proc?.kill(); }
}

async function freshClient() {
  client?.close();
  client = new McpClient();
  await client.start();
}

async function execute(message) {
  if (!client) await freshClient();
  if (message.method === "tools/call" && client.calls >= callLimit) {
    throw new Error(`Batas aman sesi HTTP Toolkit tercapai (${client.calls} panggilan).`);
  }
  if (message.method === "tools/call") client.calls++;
  try {
    return await client.request(message.method, message.params || {});
  } catch (error) {
    throw error;
  }
}

const server = createServer((socket) => {
  let buffer = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buffer += chunk;
    while (buffer.includes("\n")) {
      const split = buffer.indexOf("\n");
      const line = buffer.slice(0, split).trim();
      buffer = buffer.slice(split + 1);
      if (!line) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      queue = queue.then(async () => {
        try {
          const result = await execute(message);
          socket.write(`${JSON.stringify({ id: message.id, result })}\n`);
        } catch (error) {
          socket.write(`${JSON.stringify({ id: message.id, error: error.message })}\n`);
        }
      });
    }
  });
});

await freshClient();
server.listen(port, "127.0.0.1", () => console.log(`READY ${port}`));
