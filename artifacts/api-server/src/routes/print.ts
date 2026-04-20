import { Router, type IRouter } from "express";
import net from "net";

const router: IRouter = Router();

function buildEscPos(lines: { text: string; bold?: boolean; center?: boolean; size?: "normal" | "large" | "small"; divider?: boolean }[]): Buffer {
  const ESC = 0x1b;
  const GS = 0x1d;
  const chunks: Buffer[] = [];

  const cmd = (...bytes: number[]) => chunks.push(Buffer.from(bytes));
  const text = (str: string) => chunks.push(Buffer.from(str + "\n", "utf8"));

  // Initialize
  cmd(ESC, 0x40);
  // Set UTF-8 code page
  cmd(ESC, 0x74, 0x10);

  for (const line of lines) {
    if (line.divider) {
      cmd(ESC, 0x61, 0x01); // center
      text("--------------------------------");
      continue;
    }

    // Alignment
    cmd(ESC, 0x61, line.center ? 0x01 : 0x00);

    // Bold
    cmd(ESC, 0x45, line.bold ? 1 : 0);

    // Size
    if (line.size === "large") {
      cmd(GS, 0x21, 0x11); // double width+height
    } else if (line.size === "small") {
      cmd(GS, 0x21, 0x00);
      cmd(ESC, 0x21, 0x01); // small font
    } else {
      cmd(GS, 0x21, 0x00);
      cmd(ESC, 0x21, 0x00);
    }

    text(line.text || "");
  }

  // Reset
  cmd(ESC, 0x61, 0x00);
  cmd(ESC, 0x45, 0);
  cmd(GS, 0x21, 0x00);
  cmd(ESC, 0x21, 0x00);

  // Feed and cut
  cmd(ESC, 0x64, 0x04); // feed 4 lines
  cmd(GS, 0x56, 0x42, 0x00); // full cut

  return Buffer.concat(chunks);
}

router.post("/print/network", async (req, res): Promise<void> => {
  const { ip, port = 9100, lines } = req.body as {
    ip: string;
    port?: number;
    lines: { text: string; bold?: boolean; center?: boolean; size?: string; divider?: boolean }[];
  };

  if (!ip || !lines) {
    res.status(400).json({ error: "ip and lines required" });
    return;
  }

  const data = buildEscPos(lines as Parameters<typeof buildEscPos>[0]);

  const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: "Connection timed out" });
    }, 5000);

    socket.connect(port, ip, () => {
      socket.write(data, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ ok: true });
      });
    });

    socket.on("error", (err) => {
      clearTimeout(timeout);
      socket.destroy();
      resolve({ ok: false, error: err.message });
    });
  });

  if (result.ok) {
    res.json({ ok: true });
  } else {
    res.status(502).json({ ok: false, error: result.error });
  }
});

export function bridgeScriptContent(): string {
  return `#!/usr/bin/env node
// Island Tacos - Local Print Bridge
// ===================================
// This script runs on any computer on your local WiFi network.
// It receives print jobs from the POS and sends them to your receipt printer.
//
// Requirements: Node.js (https://nodejs.org) — no other installs needed.
//
// Usage:
//   node island-tacos-bridge.js
//
// Custom printer IP or port:
//   PRINTER_IP=192.168.8.195 PRINTER_PORT=9100 node island-tacos-bridge.js
//
// On Windows (PowerShell):
//   $env:PRINTER_IP="192.168.8.195"; node island-tacos-bridge.js

const http = require('http');
const net  = require('net');

const PRINTER_IP   = process.env.PRINTER_IP   || '192.168.8.195';
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT || '9100');
const BRIDGE_PORT  = parseInt(process.env.PORT || '8765');

function buildEscPos(lines) {
  const ESC = 0x1b, GS = 0x1d;
  const chunks = [];
  const cmd  = (...b) => chunks.push(Buffer.from(b));
  const text = (s)    => chunks.push(Buffer.from(s + '\\n', 'utf8'));

  cmd(ESC, 0x40);       // initialize
  cmd(ESC, 0x74, 0x10); // UTF-8 code page

  for (const line of lines) {
    if (line.divider) { cmd(ESC, 0x61, 0x01); text('--------------------------------'); continue; }
    cmd(ESC, 0x61, line.center ? 0x01 : 0x00);
    cmd(ESC, 0x45, line.bold   ? 1    : 0);
    if      (line.size === 'large') { cmd(GS, 0x21, 0x11); }
    else if (line.size === 'small') { cmd(GS, 0x21, 0x00); cmd(ESC, 0x21, 0x01); }
    else                            { cmd(GS, 0x21, 0x00); cmd(ESC, 0x21, 0x00); }
    text(line.text || '');
  }

  cmd(ESC, 0x61, 0x00); cmd(ESC, 0x45, 0);
  cmd(GS,  0x21, 0x00); cmd(ESC, 0x21, 0x00);
  cmd(ESC, 0x64, 0x04);       // feed 4 lines
  cmd(GS,  0x56, 0x42, 0x00); // full cut
  return Buffer.concat(chunks);
}

function sendToPrinter(data) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('Timed out')); }, 5000);
    socket.connect(PRINTER_PORT, PRINTER_IP, () => {
      socket.write(data, () => { clearTimeout(timer); socket.destroy(); resolve(); });
    });
    socket.on('error', err => { clearTimeout(timer); socket.destroy(); reject(err); });
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Island Tacos Print Bridge OK — printer: ' + PRINTER_IP + ':' + PRINTER_PORT);
    return;
  }

  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { lines } = JSON.parse(body);
        if (!Array.isArray(lines)) throw new Error('lines must be an array');
        await sendToPrinter(buildEscPos(lines));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        console.log('[' + new Date().toLocaleTimeString() + '] Receipt printed ✓');
      } catch (err) {
        console.error('[' + new Date().toLocaleTimeString() + '] Print error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }
  res.writeHead(404); res.end('Not found');
});

server.listen(BRIDGE_PORT, () => {
  console.log('');
  console.log('  ┌─────────────────────────────────────┐');
  console.log('  │   Island Tacos — Print Bridge       │');
  console.log('  ├─────────────────────────────────────┤');
  console.log('  │  Bridge port : http://localhost:' + BRIDGE_PORT + '  │');
  console.log('  │  Printer     : ' + PRINTER_IP + ':' + PRINTER_PORT + '       │');
  console.log('  └─────────────────────────────────────┘');
  console.log('');
  console.log('  Keep this window open while the POS is in use.');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});
`;
}

export default router;
