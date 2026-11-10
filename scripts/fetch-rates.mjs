#!/usr/bin/env node
// Fetches public mortgage & benchmark rate series from FRED (St. Louis Fed)
// and writes public/rates.json for the Rate Watch & Refi Trigger module.
//
// Runs in GitHub Actions on a daily schedule before each build, so the
// deployed dashboard always carries fresh market data. No API key required.
//
// If the network fetch fails, the previously committed public/rates.json is
// kept so the build never breaks.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.resolve(__dirname, '../public/rates.json');
const CONFIG_FILE = path.resolve(__dirname, 'rate-alert.config.json');

const HISTORY_DAYS = 365 * 3;

const SERIES = [
  {
    id: 'OBMMIJUMBO30YF',
    key: 'jumbo30',
    label: '30-Yr Fixed Jumbo (Optimal Blue)',
    frequency: 'daily',
  },
  {
    id: 'MORTGAGE30US',
    key: 'conforming30',
    label: '30-Yr Fixed Conforming (Freddie Mac PMMS)',
    frequency: 'weekly',
  },
  {
    id: 'MORTGAGE15US',
    key: 'conforming15',
    label: '15-Yr Fixed Conforming (Freddie Mac PMMS)',
    frequency: 'weekly',
  },
  {
    id: 'DGS10',
    key: 'treasury10',
    label: '10-Yr U.S. Treasury Yield',
    frequency: 'daily',
  },
  {
    id: 'SOFR30DAYAVG',
    key: 'sofr30',
    label: '30-Day Average SOFR (ARM Index)',
    frequency: 'daily',
  },
];

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function fetchSeries(id, startDate) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${startDate}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'bergen-arm-optimizer/1.0' } });
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/).slice(1);
  const points = [];
  for (const line of lines) {
    const [date, raw] = line.split(',');
    const value = Number(raw);
    if (!date || raw === '.' || raw === '' || !Number.isFinite(value)) continue;
    points.push({ date, value: Math.round(value * 1000) / 1000 });
  }
  if (points.length === 0) throw new Error(`${id}: no observations returned`);
  return points;
}

async function main() {
  const start = new Date(Date.now() - HISTORY_DAYS * 86400000);
  const startDate = isoDate(start);

  let alertConfig = {};
  try {
    alertConfig = JSON.parse(await readFile(CONFIG_FILE, 'utf8'));
  } catch {
    console.warn('No rate-alert.config.json found; continuing without alert config.');
  }

  const series = {};
  try {
    for (const s of SERIES) {
      const points = await fetchSeries(s.id, startDate);
      const latest = points[points.length - 1];
      series[s.key] = {
        fredId: s.id,
        label: s.label,
        frequency: s.frequency,
        latest,
        points,
      };
      console.log(`✓ ${s.id}: ${points.length} obs, latest ${latest.date} = ${latest.value}%`);
    }
  } catch (err) {
    console.warn(`⚠ Rate fetch failed (${err.message}). Keeping existing public/rates.json.`);
    process.exit(0);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'Federal Reserve Bank of St. Louis (FRED)',
    alertConfig,
    series,
  };

  await writeFile(OUT_FILE, JSON.stringify(payload));
  console.log(`Wrote ${OUT_FILE}`);
}

main();
