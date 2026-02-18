#!/usr/bin/env node

/**
 * One-off script to import FCR contracted reserves from the ENTSO-E CSV format.
 * Only inserts rows whose timestamp does not already exist in Convex for that year.
 *
 * Usage:
 *   node scripts/seed-fcr-csv.js <path-to-csv>
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

const csvPath = process.argv[2];
if (!csvPath || !fs.existsSync(csvPath)) {
  console.error('Usage: node scripts/seed-fcr-csv.js <path-to-csv>');
  process.exit(1);
}

function parseCsv(filePath) {
  const csvText = fs.readFileSync(filePath, 'utf-8');
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    console.warn(`CSV parse warning: ${parsed.errors[0].message}`);
  }
  return parsed.data;
}

function loadRows(filePath) {
  const rawRows = parseCsv(filePath);
  const result = [];

  for (const row of rawRows) {
    const zone = String(row.bidding_zone || '').trim();
    if (zone !== 'NO1') continue;

    const tsStr = String(row.timestamp || '').trim();
    if (!tsStr) continue;

    const date = new Date(tsStr);
    const timestamp = date.getTime();
    if (Number.isNaN(timestamp)) continue;

    const year = date.getUTCFullYear();
    const hourNumber = date.getUTCHours();
    const priceEurMw = Number(row.price_eur_mw) || 0;
    const volumeMw = Number(row.quantity_mw) || 0;

    result.push({
      year,
      area: zone,
      timestamp,
      hourNumber,
      priceEurMw,
      volumeMw,
    });
  }

  return result;
}

async function fetchExistingTimestamps(year) {
  const existing = new Set();
  let cursor = null;

  while (true) {
    const result = await convex.query('prices:getPriceDataPage', {
      year,
      area: 'NO1',
      paginationOpts: { numItems: 1000, cursor },
    });

    for (const row of result.page) {
      existing.add(row.timestamp);
    }

    if (result.isDone) break;
    cursor = result.continueCursor;
  }

  return existing;
}

async function insertInChunks(rows) {
  let inserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const result = await convex.mutation('ingest:insertPriceRows', { rows: chunk });
    inserted += result.inserted;

    if ((i / CHUNK_SIZE) % 10 === 0 || inserted >= rows.length) {
      console.log(`  insertPriceRows: ${inserted}/${rows.length}`);
    }
  }

  return inserted;
}

(async function main() {
  console.log(`Reading ${csvPath}`);
  const allRows = loadRows(csvPath);
  console.log(`Parsed ${allRows.length} NO1 rows from CSV`);

  // Group by year
  const byYear = new Map();
  for (const row of allRows) {
    if (!byYear.has(row.year)) byYear.set(row.year, []);
    byYear.get(row.year).push(row);
  }

  const sortedYears = Array.from(byYear.keys()).sort((a, b) => a - b);
  console.log(`Years in CSV: ${sortedYears.join(', ')}`);

  let totalInserted = 0;

  for (const year of sortedYears) {
    const csvRows = byYear.get(year);
    console.log(`\nYear ${year}: ${csvRows.length} rows in CSV`);

    const existingTs = await fetchExistingTimestamps(year);
    console.log(`  ${existingTs.size} rows already in Convex`);

    const newRows = csvRows.filter((row) => !existingTs.has(row.timestamp));
    console.log(`  ${newRows.length} new rows to insert`);

    if (newRows.length === 0) {
      console.log(`  Skipping year ${year} — nothing new.`);
      continue;
    }

    const inserted = await insertInChunks(newRows);
    console.log(`  Inserted ${inserted} rows for year ${year}`);
    totalInserted += inserted;
  }

  console.log(`\nDone. Total inserted: ${totalInserted} rows.`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
