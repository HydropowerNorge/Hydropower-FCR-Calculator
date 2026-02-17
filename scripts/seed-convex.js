#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const Papa = require('papaparse');
const dotenv = require('dotenv');
const { ConvexHttpClient } = require('convex/browser');

const CHUNK_SIZE = 200;
const projectRoot = path.resolve(__dirname, '..');
const SOLAR_DATASET_CONFIGS = [
  {
    resolutionMinutes: 60,
    label: 'hourly',
    envVar: 'SOLAR_PRODUCTION_HOURLY_JSON',
    legacyEnvVar: 'SOLAR_PRODUCTION_JSON',
    fileName: 'solar_production_hourly_2026.json',
  },
  {
    resolutionMinutes: 15,
    label: '15min',
    envVar: 'SOLAR_PRODUCTION_15MIN_JSON',
    fileName: 'solar_production_15min_2026.json',
  },
];

dotenv.config({ path: path.join(projectRoot, '.env.local') });
dotenv.config({ path: path.join(projectRoot, '.env') });

const convexUrl = process.env.CONVEX_URL;
if (!convexUrl) {
  console.error('Missing CONVEX_URL. Run `npx convex dev --once` first or set CONVEX_URL in .env.local/.env.');
  process.exit(1);
}

const convex = new ConvexHttpClient(convexUrl);

function readCsv(filePath) {
  const csvText = fs.readFileSync(filePath, 'utf-8');
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    console.warn(`CSV parse warning in ${filePath}: ${first.message}`);
  }
  return parsed.data;
}

function readJson(filePath) {
  const jsonText = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(jsonText);
}

function parseFcrTimestamp(value) {
  if (!value || typeof value !== 'string') return null;

  const match = value
    .trim()
    .match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+([+-])(\d{2}):(\d{2})$/);

  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }

  const [, day, month, year, hour, minute, second, sign, offsetHour, offsetMinute] = match;

  const offsetMinutes =
    (sign === '+' ? 1 : -1) *
    (Number(offsetHour) * 60 + Number(offsetMinute));

  const naiveUtcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  return naiveUtcMs - offsetMinutes * 60 * 1000;
}

function parseNaiveIsoTimestamp(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (match) {
    const [, year, month, day, hour, minute, second = '0'] = match;
    return Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      0,
    );
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function findFirstExisting(paths) {
  for (const filePath of paths) {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

function findPriceFiles() {
  const searchDirs = [
    path.join(projectRoot, 'data'),
  ];

  const byYear = new Map();

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;

    for (const name of fs.readdirSync(dir)) {
      const match = name.match(/^PrimaryReservesD-1-(\d{4})\.csv$/);
      if (!match) continue;

      const year = Number(match[1]);
      if (!byYear.has(year)) {
        byYear.set(year, path.join(dir, name));
      }
    }
  }

  return Array.from(byYear.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, filePath]) => filePath);
}

function loadPriceRows(filePath) {
  const rows = readCsv(filePath);
  const yearMatch = path.basename(filePath).match(/(\d{4})/);
  const defaultYear = yearMatch ? Number(yearMatch[1]) : null;

  const result = [];
  for (const row of rows) {
    const timestamp = parseFcrTimestamp(row['Time(Local)']);
    if (timestamp === null) continue;

    const year = defaultYear ?? new Date(timestamp).getUTCFullYear();

    result.push({
      year,
      area: String(row.Area || '').trim(),
      timestamp,
      hourNumber: Number(row.Hournumber) || 0,
      priceEurMw: Number(row['FCR-N Price EUR/MW']) || 0,
      volumeMw: Number(row['FCR-N Volume MW']) || 0,
    });
  }

  return result.filter((row) => row.area.length > 0);
}

function loadSpotRows(filePath) {
  const rows = readCsv(filePath);
  const byHour = new Map();

  for (const row of rows) {
    const timestamp = new Date(row.timestamp);
    if (Number.isNaN(timestamp.getTime())) continue;

    const zone = String(row.bidding_zone || 'NO1').trim() || 'NO1';
    const hourTimestamp = new Date(
      timestamp.getFullYear(),
      timestamp.getMonth(),
      timestamp.getDate(),
      timestamp.getHours(),
      0,
      0,
      0,
    ).getTime();

    const key = `${zone}|${hourTimestamp}`;
    if (!byHour.has(key)) {
      byHour.set(key, {
        biddingZone: zone,
        timestamp: hourTimestamp,
        sum: 0,
        count: 0,
      });
    }

    const item = byHour.get(key);
    item.sum += Number(row.price_eur_mwh) || 0;
    item.count += 1;
  }

  return Array.from(byHour.values())
    .map((row) => ({
      biddingZone: row.biddingZone,
      timestamp: row.timestamp,
      spotPriceEurMwh: row.count > 0 ? row.sum / row.count : 0,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function findSolarProductionDatasets() {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const datasets = [];

  for (const config of SOLAR_DATASET_CONFIGS) {
    const configuredPath = process.env[config.envVar]
      || (config.legacyEnvVar ? process.env[config.legacyEnvVar] : null);

    const candidates = [
      configuredPath,
      path.join(projectRoot, 'data', 'solar', config.fileName),
      path.join(projectRoot, 'data', config.fileName),
      homeDir ? path.join(homeDir, 'Downloads', config.fileName) : null,
      `/Users/sander/Downloads/${config.fileName}`,
    ].filter(Boolean);

    const filePath = findFirstExisting(candidates);
    if (!filePath) continue;

    datasets.push({
      filePath,
      label: config.label,
      resolutionMinutes: config.resolutionMinutes,
    });
  }

  return datasets;
}

function loadSolarRows(filePath, resolutionMinutes) {
  const rows = readJson(filePath);
  if (!Array.isArray(rows)) {
    throw new Error(`Expected array in ${filePath}`);
  }

  const result = [];
  for (const row of rows) {
    const timestamp = parseNaiveIsoTimestamp(row.timestamp);
    if (timestamp === null) continue;

    const year = new Date(timestamp).getUTCFullYear();
    const production = Number(row.production);
    if (!Number.isFinite(production)) continue;

    result.push({
      year,
      resolutionMinutes,
      timestamp,
      production,
    });
  }

  return result.sort((a, b) => a.timestamp - b.timestamp);
}

function detectDominantIntervalMinutes(rows) {
  const intervalCounts = new Map();
  const limit = Math.min(rows.length, 5000);

  for (let i = 1; i < limit; i += 1) {
    const diffMs = rows[i].timestamp - rows[i - 1].timestamp;
    if (diffMs <= 0) continue;

    const minutes = Math.round(diffMs / (60 * 1000));
    if (!Number.isInteger(minutes) || minutes <= 0) continue;

    intervalCounts.set(minutes, (intervalCounts.get(minutes) || 0) + 1);
  }

  let dominantInterval = null;
  let dominantCount = -1;
  for (const [minutes, count] of intervalCounts.entries()) {
    if (count > dominantCount) {
      dominantInterval = minutes;
      dominantCount = count;
    }
  }

  return dominantInterval;
}

async function clearPriceYear(year) {
  let totalDeleted = 0;
  while (true) {
    const result = await convex.mutation('ingest:clearPriceYear', { year });
    totalDeleted += result.deleted;
    if (result.done) break;
  }
  console.log(`Cleared fcrPrices year ${year}: ${totalDeleted} rows`);
}

async function clearSpotZone(biddingZone) {
  let totalDeleted = 0;
  while (true) {
    const result = await convex.mutation('ingest:clearSpotZone', { biddingZone });
    totalDeleted += result.deleted;
    if (result.done) break;
  }
  console.log(`Cleared spotPrices zone ${biddingZone}: ${totalDeleted} rows`);
}

async function clearSolarSeries(year, resolutionMinutes) {
  let totalDeleted = 0;
  while (true) {
    const result = await convex.mutation('ingest:clearSolarSeries', { year, resolutionMinutes });
    totalDeleted += result.deleted;
    if (result.done) break;
  }
  console.log(`Cleared solarProduction year ${year} (${resolutionMinutes}m): ${totalDeleted} rows`);
}

async function clearSolarSeriesMeta(year, resolutionMinutes) {
  let totalDeleted = 0;
  while (true) {
    const result = await convex.mutation('ingest:clearSolarSeriesMeta', { year, resolutionMinutes });
    totalDeleted += result.deleted;
    if (result.done) break;
  }
  console.log(`Cleared solarSeries meta year ${year} (${resolutionMinutes}m): ${totalDeleted} rows`);
}

async function setSolarSeriesMeta(year, resolutionMinutes, sampleCount) {
  await convex.mutation('ingest:setSolarSeriesMeta', {
    series: {
      year,
      resolutionMinutes,
      sampleCount,
    },
  });
}

async function insertInChunks(functionName, rows) {
  let inserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const result = await convex.mutation(functionName, { rows: chunk });
    inserted += result.inserted;

    if ((i / CHUNK_SIZE) % 20 === 0 || inserted === rows.length) {
      console.log(`  ${functionName}: ${inserted}/${rows.length}`);
    }
  }

  return inserted;
}

async function seedPrices() {
  const files = findPriceFiles();
  if (files.length === 0) {
    console.warn('No PrimaryReservesD-1-*.csv files found. Skipping fcrPrices import.');
    return;
  }

  const groupedByYear = new Map();

  for (const filePath of files) {
    console.log(`Reading ${filePath}`);
    const rows = loadPriceRows(filePath);

    for (const row of rows) {
      if (!groupedByYear.has(row.year)) {
        groupedByYear.set(row.year, []);
      }
      groupedByYear.get(row.year).push(row);
    }
  }

  for (const year of Array.from(groupedByYear.keys()).sort((a, b) => a - b)) {
    const rows = groupedByYear.get(year);
    await clearPriceYear(year);
    const inserted = await insertInChunks('ingest:insertPriceRows', rows);
    console.log(`Imported fcrPrices year ${year}: ${inserted} rows`);
  }
}

async function seedSpot() {
  const spotFile = findFirstExisting([
    path.join(projectRoot, 'data', 'spot', 'entsoe_spot_prices_rows.csv'),
  ]);

  if (!spotFile) {
    console.warn('No entsoe_spot_prices_rows.csv found. Skipping spotPrices import.');
    return;
  }

  console.log(`Reading ${spotFile}`);
  const rows = loadSpotRows(spotFile);
  const byZone = new Map();

  for (const row of rows) {
    if (!byZone.has(row.biddingZone)) {
      byZone.set(row.biddingZone, []);
    }
    byZone.get(row.biddingZone).push(row);
  }

  for (const biddingZone of Array.from(byZone.keys()).sort()) {
    const zoneRows = byZone.get(biddingZone);
    await clearSpotZone(biddingZone);
    const inserted = await insertInChunks('ingest:insertSpotRows', zoneRows);
    console.log(`Imported spotPrices zone ${biddingZone}: ${inserted} rows`);
  }
}

async function importSolarDataset(dataset) {
  console.log(`Reading ${dataset.filePath}`);
  const rows = loadSolarRows(dataset.filePath, dataset.resolutionMinutes);
  if (rows.length === 0) {
    console.warn(`No valid solar rows found for ${dataset.label} (${dataset.resolutionMinutes}m). Skipping.`);
    return;
  }

  const dominantInterval = detectDominantIntervalMinutes(rows);
  if (
    dominantInterval !== null
    && dominantInterval !== dataset.resolutionMinutes
  ) {
    throw new Error(
      `Solar resolution mismatch for ${dataset.filePath}: expected ${dataset.resolutionMinutes}m, detected ${dominantInterval}m. Aborting to avoid mixed-resolution data.`,
    );
  }

  const groupedByYear = new Map();
  for (const row of rows) {
    if (!groupedByYear.has(row.year)) {
      groupedByYear.set(row.year, []);
    }
    groupedByYear.get(row.year).push(row);
  }

  for (const year of Array.from(groupedByYear.keys()).sort((a, b) => a - b)) {
    const yearRows = groupedByYear.get(year);
    await clearSolarSeries(year, dataset.resolutionMinutes);
    await clearSolarSeriesMeta(year, dataset.resolutionMinutes);
    const inserted = await insertInChunks('ingest:insertSolarRows', yearRows);
    await setSolarSeriesMeta(year, dataset.resolutionMinutes, inserted);
    console.log(
      `Imported solarProduction year ${year} (${dataset.resolutionMinutes}m ${dataset.label}): ${inserted} rows`,
    );
  }
}

async function seedSolarProduction() {
  const datasets = findSolarProductionDatasets();
  if (datasets.length === 0) {
    console.warn(
      'No solar production files found. Expected hourly and/or 15min JSON files. Skipping solarProduction import.',
    );
    return;
  }

  for (const dataset of datasets.sort((a, b) => a.resolutionMinutes - b.resolutionMinutes)) {
    await importSolarDataset(dataset);
  }
}

async function countPaginatedRows(functionName, args) {
  let total = 0;
  let cursor = null;

  while (true) {
    const result = await convex.query(functionName, {
      ...args,
      paginationOpts: {
        numItems: 1000,
        cursor,
      },
    });

    total += result.page.length;
    if (result.isDone) return total;
    cursor = result.continueCursor;
  }
}

async function sanityCheck() {
  const years = await convex.query('prices:getAvailableYears', { area: 'NO1' });
  console.log(`NO1 years in Convex: ${years.join(', ') || '(none)'}`);

  if (years.length > 0) {
    const latestYear = years[years.length - 1];
    const priceRowCount = await countPaginatedRows('prices:getPriceDataPage', {
      year: latestYear,
      area: 'NO1',
    });
    console.log(`NO1 price rows for ${latestYear}: ${priceRowCount}`);
  }

  const spotRowCount = await countPaginatedRows('spot:getSpotDataPage', {
    biddingZone: 'NO1',
  });
  console.log(`NO1 spot hourly rows: ${spotRowCount}`);

  const solarResolutions = await convex.query('solar:getAvailableResolutions', {});
  console.log(`Solar resolutions in Convex: ${solarResolutions.join(', ') || '(none)'}`);

  for (const resolutionMinutes of solarResolutions) {
    const solarYears = await convex.query('solar:getAvailableYears', {
      resolutionMinutes,
    });
    console.log(`Solar years in Convex (${resolutionMinutes}m): ${solarYears.join(', ') || '(none)'}`);

    if (solarYears.length > 0) {
      const latestSolarYear = solarYears[solarYears.length - 1];
      const solarRowCount = await countPaginatedRows('solar:getSolarDataPage', {
        year: latestSolarYear,
        resolutionMinutes,
      });
      console.log(`Solar rows for ${latestSolarYear} (${resolutionMinutes}m): ${solarRowCount}`);
    }
  }
}

(async function main() {
  console.log(`Seeding Convex at ${convexUrl}`);

  await seedPrices();
  await seedSpot();
  await seedSolarProduction();
  await sanityCheck();

  console.log('Done.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
