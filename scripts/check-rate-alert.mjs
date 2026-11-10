#!/usr/bin/env node
// Reads public/rates.json and decides whether a refinance alert should fire.
// Emits GitHub Actions outputs: status (refi|watch|hold), effective, market, body.
//
// effective rate = latest benchmark market rate − Wells Fargo relationship discount

import { readFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(await readFile(path.resolve(__dirname, '../public/rates.json'), 'utf8'));
const cfg = data.alertConfig ?? {};

const seriesKey = cfg.benchmarkSeries ?? 'jumbo30';
const series = data.series?.[seriesKey];
if (!series) {
  console.log(`No series "${seriesKey}" in rates.json; skipping alert check.`);
  process.exit(0);
}

const market = series.latest.value;
const discount = cfg.relationshipDiscount ?? 0.5;
const effective = Math.round((market - discount) * 1000) / 1000;
const alertAt = cfg.alertEffectiveRate ?? 5.0;
const watchAt = cfg.watchEffectiveRate ?? 5.375;
const noteRate = cfg.currentNoteRate ?? 5.75;

const status = effective <= alertAt ? 'refi' : effective <= watchAt ? 'watch' : 'hold';

const mention = cfg.notifyGithubUser ? `@${cfg.notifyGithubUser} ` : '';
const body = [
  `${mention}Mortgage rates have reached your refinance trigger.`,
  '',
  `| Metric | Value |`,
  `|---|---|`,
  `| ${series.label} (${series.latest.date}) | ${market.toFixed(3)}% |`,
  `| Wells Fargo relationship discount | −${discount.toFixed(3)}% |`,
  `| **Effective refi rate** | **${effective.toFixed(3)}%** |`,
  `| Current note rate | ${noteRate.toFixed(3)}% |`,
  `| Alert threshold | ≤ ${alertAt.toFixed(3)}% |`,
  '',
  'Open the dashboard → **Rate Watch & Refi Trigger** tab to review break-even and net benefit with your current closing-cost assumptions:',
  'https://jbaum86.github.io/bergen-arm-optimizer/',
].join('\n');

console.log(`Benchmark ${market}% − ${discount}% = ${effective}% effective → status: ${status}`);

if (process.env.GITHUB_OUTPUT) {
  const delim = 'EOF_RATE_ALERT';
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `status=${status}\neffective=${effective.toFixed(3)}\nmarket=${market.toFixed(3)}\nbody<<${delim}\n${body}\n${delim}\n`
  );
}

