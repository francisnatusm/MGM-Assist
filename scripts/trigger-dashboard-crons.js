/**
 * Hit dashboard cron routes (same paths Vercel Cron calls).
 * Schedules (UTC, see vercel.json): careers 06:00; business 00:00;
 * economy monthly 1st 00:00; opportunities 02:00; pulse 08:00 (hour windows on Hobby).
 * Hobby: Vercel may fire anytime within that hour.
 *
 * MGM_API_BASE_URL=https://your-app.vercel.app node scripts/trigger-dashboard-crons.js
 * If CRON_SECRET is set in Vercel, set it locally too for manual runs.
 */
require('dotenv').config();
const http = require('http');
const https = require('https');

const paths = [
  '/api/cron/refresh/careers',
  '/api/cron/refresh/business',
  '/api/cron/refresh/economy',
  '/api/cron/refresh/opportunities',
  '/api/cron/refresh/pulse'
];

function getBaseUrl() {
  const fromEnv =
    process.env.MGM_API_BASE_URL ||
    process.env.VITE_API_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  return (fromEnv || 'http://127.0.0.1:3003').replace(/\/$/, '');
}

function fetchUrl(url, timeoutMs = 600_000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    /** @type {import('http').RequestOptions} */
    const opts = { method: 'GET', timeout: timeoutMs, headers: {} };
    if (process.env.CRON_SECRET) {
      opts.headers.Authorization = `Bearer ${process.env.CRON_SECRET}`;
    }
    const req = lib.request(
      url,
      opts,
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.end();
  });
}

(async () => {
  const base = getBaseUrl();
  console.log(`Base URL: ${base}\n`);
  for (const p of paths) {
    const url = `${base}${p}`;
    process.stdout.write(`${p} … `);
    try {
      const { status, body } = await fetchUrl(url);
      console.log(status, body.slice(0, 200).replace(/\s+/g, ' '));
    } catch (e) {
      console.log('ERROR', e.message);
    }
  }
  console.log('\nDone.');
})();
