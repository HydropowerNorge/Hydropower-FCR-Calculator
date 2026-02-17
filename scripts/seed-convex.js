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
const NODE_TENDERS_FILE_NAME = 'node_tenders_2026.json';

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

function parseIsoTimestamp(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

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

function findNodeTendersFile() {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  return findFirstExisting([
    process.env.NODE_TENDERS_JSON,
    path.join(projectRoot, 'convex', 'seed', NODE_TENDERS_FILE_NAME),
    path.join(projectRoot, 'data', 'nodes', NODE_TENDERS_FILE_NAME),
    homeDir ? path.join(homeDir, 'Downloads', NODE_TENDERS_FILE_NAME) : null,
    `/Users/sander/Downloads/${NODE_TENDERS_FILE_NAME}`,
  ].filter(Boolean));
}

function sanitizeWindows(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((window) => {
      if (!window || typeof window !== 'object') return null;
      const start = typeof window.start === 'string' ? window.start.trim() : '';
      const end = typeof window.end === 'string' ? window.end.trim() : '';
      if (!start || !end) return null;
      return { start, end };
    })
    .filter(Boolean);
}

function loadNodeTenderRows(filePath) {
  const rows = readJson(filePath);
  if (!Array.isArray(rows)) {
    throw new Error(`Expected array in ${filePath}`);
  }

  const result = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;

    const dataset = String(row.dataset || '').trim() || 'nodes_2026_pilot';
    const tenderId = String(row.tenderId || '').trim();
    const name = String(row.name || '').trim();
    const status = String(row.status || '').trim() || 'Unknown';
    const quantityType = String(row.quantityType || '').trim() || 'Power';
    const quantityMw = Number(row.quantityMw);
    const marketTimeZone = String(row.marketTimeZone || '').trim() || 'Europe/Oslo';
    const gridNode = String(row.gridNode || '').trim();
    const market = String(row.market || '').trim();
    const periodStartTs = parseIsoTimestamp(row.periodFrom);
    const periodEndTs = parseIsoTimestamp(row.periodTo);

    if (!tenderId || !name || !gridNode || !market) continue;
    if (!Number.isFinite(quantityMw)) continue;
    if (periodStartTs === null || periodEndTs === null) continue;

    const availabilityPriceNokMwH = Number(row.availabilityPriceNokMwH);
    const reservationPriceNokMwH = Number(row.reservationPriceNokMwH);
    const activationPriceNokMwH = Number(row.activationPriceNokMwH);
    const peakReductionTargetMw = Number(row.peakReductionTargetMw);
    const activationNoticeDays = Number(row.activationNoticeDays);

    const parsed = {
      dataset,
      tenderId,
      name,
      status,
      quantityType,
      quantityMw,
      regulationType: row.regulationType ? String(row.regulationType).trim() : undefined,
      activationType: row.activationType ? String(row.activationType).trim() : undefined,
      peakReductionTargetMw: Number.isFinite(peakReductionTargetMw) ? peakReductionTargetMw : undefined,
      availabilityPriceNokMwH: Number.isFinite(availabilityPriceNokMwH) ? availabilityPriceNokMwH : undefined,
      reservationPriceNokMwH: Number.isFinite(reservationPriceNokMwH)
        ? reservationPriceNokMwH
        : (Number.isFinite(availabilityPriceNokMwH) ? availabilityPriceNokMwH : undefined),
      activationPriceNokMwH: Number.isFinite(activationPriceNokMwH) ? activationPriceNokMwH : undefined,
      marketTimeZone,
      activationDeadlineLocal: row.activationDeadlineLocal
        ? String(row.activationDeadlineLocal).trim()
        : undefined,
      activationNoticeDays: Number.isFinite(activationNoticeDays) ? activationNoticeDays : undefined,
      gridNode,
      gridNodeId: row.gridNodeId ? String(row.gridNodeId).trim() : undefined,
      market,
      marketId: row.marketId ? String(row.marketId).trim() : undefined,
      organization: row.organization ? String(row.organization).trim() : undefined,
      organizationId: row.organizationId ? String(row.organizationId).trim() : undefined,
      periodStartTs,
      periodEndTs,
      openFromTs: parseIsoTimestamp(row.openFrom) ?? undefined,
      toFromTs: parseIsoTimestamp(row.toFrom) ?? undefined,
      activeDays: Array.isArray(row.activeDays)
        ? row.activeDays.map((item) => String(item).trim()).filter(Boolean)
        : [],
      activeWindows: sanitizeWindows(row.activeWindows),
      exceptions: row.exceptions ? String(row.exceptions).trim() : undefined,
      comments: row.comments ? String(row.comments).trim() : undefined,
      source: row.source ? String(row.source).trim() : 'manual',
      createdAtTs: parseIsoTimestamp(row.createdDate) ?? Date.now(),
    };

    result.push(parsed);
  }

  return result.sort((a, b) => a.periodStartTs - b.periodStartTs);
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

async function clearNodeTenderDataset(dataset) {
  let totalDeleted = 0;
  while (true) {
    const result = await convex.mutation('ingest:clearNodeTenderDataset', { dataset });
    totalDeleted += result.deleted;
    if (result.done) break;
  }
  console.log(`Cleared nodeTenders dataset ${dataset}: ${totalDeleted} rows`);
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

async function seedNodeTenders() {
  const nodeTendersFile = findNodeTendersFile();
  if (!nodeTendersFile) {
    console.warn('No node tender JSON found. Skipping nodeTenders import.');
    return;
  }

  console.log(`Reading ${nodeTendersFile}`);
  const rows = loadNodeTenderRows(nodeTendersFile);
  if (rows.length === 0) {
    console.warn('No valid node tender rows found. Skipping nodeTenders import.');
    return;
  }

  const byDataset = new Map();
  for (const row of rows) {
    if (!byDataset.has(row.dataset)) {
      byDataset.set(row.dataset, []);
    }
    byDataset.get(row.dataset).push(row);
  }

  for (const dataset of Array.from(byDataset.keys()).sort()) {
    const datasetRows = byDataset.get(dataset);
    await clearNodeTenderDataset(dataset);
    const inserted = await insertInChunks('ingest:insertNodeTenderRows', datasetRows);
    console.log(`Imported nodeTenders dataset ${dataset}: ${inserted} rows`);
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

  const nodeFilters = await convex.query('nodes:getNodeFilterOptions', {
    dataset: 'nodes_2026_pilot',
  });
  console.log(
    `Node tender filters (${nodeFilters.total} rows): gridNodes=${nodeFilters.gridNodes.join(', ') || '(none)'}, markets=${nodeFilters.markets.join(', ') || '(none)'}`,
  );

  const nodeRowCount = await countPaginatedRows('nodes:getNodeTendersPage', {
    dataset: 'nodes_2026_pilot',
  });
  console.log(`Node tenders rows for nodes_2026_pilot: ${nodeRowCount}`);
}

(async function main() {
  console.log(`Seeding Convex at ${convexUrl}`);

  await seedPrices();
  await seedSpot();
  await seedSolarProduction();
  await seedNodeTenders();
  await sanityCheck();

  console.log('Done.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
