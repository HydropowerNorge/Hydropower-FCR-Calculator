#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3002;
const HOST = '127.0.0.1';
const LOGS_DIR = path.join(__dirname, '..', 'logs');
const KEEP_DAYS = 24;

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function getLogFilePath() {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(LOGS_DIR, `app-${date}.log`);
}

function writeLogEntry(entry) {
  ensureLogsDir();
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(getLogFilePath(), line, 'utf8');
}

function pruneOldLogs() {
  try {
    const cutoff = Date.now() - KEEP_DAYS * 86400000;
    for (const file of fs.readdirSync(LOGS_DIR)) {
      const match = file.match(/^app-(\d{4}-\d{2}-\d{2})\.log$/);
      if (!match) continue;
      if (new Date(match[1]).getTime() < cutoff) {
        fs.unlinkSync(path.join(LOGS_DIR, file));
      }
    }
  } catch { /* ignore */ }
}

const server = http.createServer((req, res) => {
  // CORS headers for browser requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/log') {
    const ip = req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const entries = Array.isArray(payload) ? payload : [payload];
        for (const entry of entries) {
          writeLogEntry({
            ts: new Date().toISOString(),
            ip,
            level: entry.level || 'info',
            module: entry.module || 'unknown',
            event: entry.event || '',
            ...(entry.data !== undefined ? { data: entry.data } : {}),
          });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(`{"ok":false,"error":"${err.message}"}`);
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end('{"ok":false,"error":"not found"}');
});

server.listen(PORT, HOST, () => {
  console.log(`[log-server] Listening on http://${HOST}:${PORT}`);
  console.log(`[log-server] Writing logs to ${LOGS_DIR}/app-YYYY-MM-DD.log (keeping ${KEEP_DAYS} days)`);
  pruneOldLogs();
  setInterval(pruneOldLogs, 86400000);
});
