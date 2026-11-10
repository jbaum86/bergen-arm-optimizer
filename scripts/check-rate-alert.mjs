#!/usr/bin/env node
// Reads public/rates.json and decides whether a refinance alert should fire.
// Emits GitHub Actions outputs: status (refi|watch|hold), effective, market, body.
//
// Evaluates both the Wells Fargo 7-Yr ARM (7/6m SOFR Jumbo) and the 30-Yr Fixed
// Jumbo benchmark after the 0.50% Wells Fargo relationship discount.

import { readFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(await readFile(path.resolve(__dirname, '../public/rates.json'), 'utf8'));
const cfg = data.alertConfig ?? {};

const seriesKey = cfg.benchmarkSeries ?? 'wf7YrArm';
const series = data.series?.[seriesKey] ?? data.series?.jumbo30;
if (!series) {
  console.log(`No series "${seriesKey}" in rates.json; skipping alert check.`);
  process.exit(0);
}

const discount = cfg.wf7YrArm?.relationshipDiscount ?? cfg.relationshipDiscount ?? 0.5;
const market = series.latest.value;
const effective = Math.round((market - discount) * 1000) / 1000;

const jumboMarket = data.series?.jumbo30?.latest?.value ?? null;
const jumboEffective = jumboMarket !== null ? Math.round((jumboMarket - discount) * 1000) / 1000 : null;
const armMarket = data.series?.wf7YrArm?.latest?.value ?? null;
const armEffective = armMarket !== null ? Math.round((armMarket - discount) * 1000) / 1000 : null;

const alertAt = cfg.alertEffectiveRate ?? 5.44;
const watchAt = cfg.watchEffectiveRate ?? 5.815;
const noteRate = cfg.currentNoteRate ?? 5.75;

const status = effective <= alertAt ? 'refi' : effective <= watchAt ? 'watch' : 'hold';

const mention = cfg.notifyGithubUser ? `@${cfg.notifyGithubUser} ` : '';
const rows = [
  `| Metric | Value |`,
  `|---|---|`,
  armMarket !== null
    ? `| Wells Fargo 7-Yr ARM Base (${data.series.wf7YrArm.latest.date}) | ${armMarket.toFixed(3)}% |`
    : null,
  armEffective !== null
    ? `| **WF 7-Yr ARM Effective (−${discount.toFixed(2)}% discount)** | **${armEffective.toFixed(3)}%** |`
    : null,
  jumboMarket !== null
    ? `| 30-Yr Fixed Jumbo (${data.series.jumbo30.latest.date}) | ${jumboMarket.toFixed(3)}% |`
    : null,
  jumboEffective !== null
    ? `| 30-Yr Fixed Jumbo Effective (−${discount.toFixed(2)}% discount) | ${jumboEffective.toFixed(3)}% |`
    : null,
  `| Current note rate | ${noteRate.toFixed(3)}% |`,
  `| Alert threshold | ≤ ${alertAt.toFixed(3)}% |`,
].filter(Boolean);

const body = [
  `${mention}Mortgage rates have reached your refinance trigger.`,
  '',
  ...rows,
  '',
  'Open the dashboard → **Rate Watch & Refi Trigger** tab to review break-even and net benefit with your current closing-cost assumptions:',
  'https://jbaum86.github.io/bergen-arm-optimizer/',
].join('\n');

console.log(
  `Active benchmark (${series.label}): ${market.toFixed(3)}% − ${discount.toFixed(3)}% = ${effective.toFixed(3)}% effective → status: ${status}`
);
if (jumboEffective !== null && armEffective !== null) {
  console.log(
    `  • WF 7-Yr ARM: ${armMarket.toFixed(3)}% base → ${armEffective.toFixed(3)}% net (−${discount.toFixed(2)}%)`
  );
  console.log(
    `  • 30-Yr Jumbo: ${jumboMarket.toFixed(3)}% base → ${jumboEffective.toFixed(3)}% net (−${discount.toFixed(2)}%)`
  );
}

if (process.env.GITHUB_OUTPUT) {
  const delim = 'EOF_RATE_ALERT';
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `status=${status}\neffective=${effective.toFixed(3)}\nmarket=${market.toFixed(3)}\nbody<<${delim}\n${body}\n${delim}\n`
  );
}
