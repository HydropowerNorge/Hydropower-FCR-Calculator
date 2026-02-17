#!/usr/bin/env node

/**
 * One-off script: replaces aFRR 2025 data in Convex with contracted reserves CSV.
 *
 * Usage:
 *   node scripts/seed-afrr-contracted-2025.js [path-to-csv]
 *
 * If no path is given, defaults to ~/Github/testing/afrr_contracted_reserves_2025-01-01_2025-12-31.csv
 */

const fs = require('node:fs');
const path = require('node:path');
const Papa = require('papaparse');
const dotenv = require('dotenv');
const { ConvexHttpClient } = require('convex/browser');

const CHUNK_SIZE = 200;
const TARGET_YEAR = 2025;
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
  || '/Users/sander/Github/testing/afrr_contracted_reserves_2025-01-01_2025-12-31.csv';

if (!fs.existsSync(csvPath)) {
  console.error(`File not found: ${csvPath}`);
  process.exit(1);
}

function parseTimestamp(value) {
  if (typeof value !== 'string') return null;
  // Normalize short offset like "+00" to "+00:00" for Date parsing
  const normalized = value.trim().replace(/([+-]\d{2})$/, '$1:00');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function loadRows(filePath) {
  const csvText = fs.readFileSync(filePath, 'utf-8');
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  const rows = [];
  for (const row of parsed.data) {
    const timestamp = parseTimestamp(row.timestamp);
    if (timestamp === null) continue;

    const year = new Date(timestamp).getUTCFullYear();
    if (year !== TARGET_YEAR) continue;

    const biddingZone = (row.bidding_zone || 'NO1').trim();
    const direction = (row.direction || '').trim().toLowerCase();
    const reserveType = (row.reserve_type || 'afrr').trim().toLowerCase();
    const quantityMw = Number(row.quantity_mw);
    const priceEurMw = Number(row.price_eur_mw);

    if (!direction) continue;

    rows.push({
      year,
      timestamp,
      biddingZone,
      direction,
      reserveType,
      resolutionMin: 60,
      contractedQuantityMw: Number.isFinite(quantityMw) ? quantityMw : undefined,
      contractedPriceEurMw: Number.isFinite(priceEurMw) ? priceEurMw : undefined,
      source: path.basename(filePath),
    });
  }

  return rows.sort((a, b) => a.timestamp - b.timestamp);
}

async function clearInBatches(functionName, args, label) {
  let totalDeleted = 0;
  while (true) {
    const result = await convex.mutation(functionName, args);
    totalDeleted += result.deleted;
    if (result.done) break;
  }
  console.log(`${label}: ${totalDeleted} rows deleted`);
}

async function insertInChunks(functionName, rows) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const result = await convex.mutation(functionName, { rows: chunk });
    inserted += result.inserted;
    if ((i / CHUNK_SIZE) % 10 === 0 || inserted === rows.length) {
      console.log(`  ${inserted}/${rows.length}`);
    }
  }
  return inserted;
}

(async function main() {
  console.log(`Reading ${csvPath}`);
  const rows = loadRows(csvPath);
  console.log(`Parsed ${rows.length} rows for ${TARGET_YEAR}`);

  if (rows.length === 0) {
    console.warn('No rows to insert. Aborting.');
    process.exit(1);
  }

  // Count by direction
  const byCounts = {};
  for (const row of rows) {
    const key = `${row.direction}/${row.reserveType}/${row.resolutionMin}m`;
    byCounts[key] = (byCounts[key] || 0) + 1;
  }
  console.log('Series breakdown:', byCounts);

  // Clear existing 2025 data
  console.log(`Clearing aFRR ${TARGET_YEAR}...`);
  await clearInBatches('ingest:clearAfrrYear', { year: TARGET_YEAR }, `afrrMarket ${TARGET_YEAR}`);
  await clearInBatches('ingest:clearAfrrSeriesYear', { year: TARGET_YEAR }, `afrrSeries ${TARGET_YEAR}`);

  // Insert new rows
  console.log('Inserting...');
  const inserted = await insertInChunks('ingest:insertAfrrRows', rows);
  console.log(`Inserted ${inserted} aFRR rows for ${TARGET_YEAR}`);

  // Update series metadata
  const seriesMap = new Map();
  for (const row of rows) {
    const key = `${row.biddingZone}|${row.direction}|${row.reserveType}|${row.resolutionMin}`;
    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        year: TARGET_YEAR,
        biddingZone: row.biddingZone,
        direction: row.direction,
        reserveType: row.reserveType,
        resolutionMin: row.resolutionMin,
        sampleCount: 0,
      });
    }
    seriesMap.get(key).sampleCount += 1;
  }

  for (const series of seriesMap.values()) {
    await convex.mutation('ingest:setAfrrSeriesMeta', { series });
    console.log(`Series ${series.biddingZone}/${series.direction}/${series.reserveType}/${series.resolutionMin}m: ${series.sampleCount} rows`);
  }

  console.log('Done.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
