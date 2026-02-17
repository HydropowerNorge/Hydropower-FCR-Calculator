#!/usr/bin/env node

/**
 * One-off script: imports spot price history into Convex from ENTSO-E CSV.
 *
 * Usage:
 *   node scripts/seed-spot-history.js [path-to-csv]
 *
 * Clears all existing NO1 spot data, then inserts hourly (PT60M) rows from CSV.
 */

const fs = require('node:fs');
const path = require('node:path');
const Papa = require('papaparse');
const dotenv = require('dotenv');
const { ConvexHttpClient } = require('convex/browser');

const CHUNK_SIZE = 200;
const projectRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(projectRoot, '.env.local') });
dotenv.config({ path: path.join(projectRoot, '.env') });

const convexUrl = process.env.CONVEX_URL;
if (!convexUrl) {
  console.error('Missing CONVEX_URL.');
  process.exit(1);
}

const convex = new ConvexHttpClient(convexUrl);

const csvPath = process.argv[2]
  || '/Users/sander/Github/testing/spot_prices_day_ahead_2021-12-31_2026-02-18.csv';

if (!fs.existsSync(csvPath)) {
  console.error(`File not found: ${csvPath}`);
  process.exit(1);
}

function parseTimestamp(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/([+-]\d{2})$/, '$1:00');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function loadRows(filePath) {
  const csvText = fs.readFileSync(filePath, 'utf-8');
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  const rows = [];
  const yearCounts = {};

  for (const row of parsed.data) {
    // Only import hourly resolution
    if ((row.resolution || '').trim() !== 'PT60M') continue;

    const timestamp = parseTimestamp(row.timestamp);
    if (timestamp === null) continue;

    const biddingZone = (row.bidding_zone || 'NO1').trim();
    const price = Number(row.price_eur_mwh);
    if (!Number.isFinite(price)) continue;

    const year = new Date(timestamp).getUTCFullYear();
    yearCounts[year] = (yearCounts[year] || 0) + 1;

    rows.push({
      biddingZone,
      timestamp,
      spotPriceEurMwh: price,
    });
  }

  console.log('Year breakdown:', yearCounts);
  return rows.sort((a, b) => a.timestamp - b.timestamp);
}

async function clearInBatches(zone) {
  let totalDeleted = 0;
  while (true) {
    const result = await convex.mutation('ingest:clearSpotZone', { biddingZone: zone });
    totalDeleted += result.deleted;
    if (result.done) break;
  }
  console.log(`Cleared ${totalDeleted} existing ${zone} spot rows`);
}

async function insertInChunks(rows) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const result = await convex.mutation('ingest:insertSpotRows', { rows: chunk });
    inserted += result.inserted;
    if ((i / CHUNK_SIZE) % 20 === 0 || inserted === rows.length) {
      console.log(`  ${inserted}/${rows.length}`);
    }
  }
  return inserted;
}

(async function main() {
  console.log(`Reading ${csvPath}`);
  const rows = loadRows(csvPath);
  console.log(`Parsed ${rows.length} hourly spot rows`);

  if (rows.length === 0) {
    console.warn('No rows to insert. Aborting.');
    process.exit(1);
  }

  console.log('Clearing existing NO1 spot data...');
  await clearInBatches('NO1');

  console.log('Inserting...');
  const inserted = await insertInChunks(rows);
  console.log(`Done. Inserted ${inserted} spot rows.`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
