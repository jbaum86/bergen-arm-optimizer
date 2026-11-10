#!/usr/bin/env node
// Reads public/rates.json and decides whether a refinance alert should fire.
// Emits GitHub Actions outputs: status (refi|watch|hold), effective, market, body.
//
// Evaluates Wells Fargo's live Brooklyn / Kings County, NY refinance rates
// (7/6-Month ARM Jumbo and 30-Year Fixed-Rate Jumbo) after the 0.50%
// Wells Fargo relationship discount.

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

const wfArmMarket = data.series?.wf7YrArm?.latest?.value ?? null;
const wfArmEffective = wfArmMarket !== null ? Math.round((wfArmMarket - discount) * 1000) / 1000 : null;
const wfJumboMarket = data.series?.wf30YrJumbo?.latest?.value ?? null;
const wfJumboEffective = wfJumboMarket !== null ? Math.round((wfJumboMarket - discount) * 1000) / 1000 : null;
const obJumboMarket = data.series?.jumbo30?.latest?.value ?? null;
const obJumboEffective = obJumboMarket !== null ? Math.round((obJumboMarket - discount) * 1000) / 1000 : null;

const alertAt = cfg.alertEffectiveRate ?? 5.44;
const watchAt = cfg.watchEffectiveRate ?? 5.815;
const noteRate = cfg.currentNoteRate ?? 5.75;

const status = effective <= alertAt ? 'refi' : effective <= watchAt ? 'watch' : 'hold';

const mention = cfg.notifyGithubUser ? `@${cfg.notifyGithubUser} ` : '';
const rows = [
  `| Metric | Value |`,
  `|---|---|`,
  wfArmMarket !== null
    ? `| Wells Fargo 7/6-Mo ARM Jumbo — Brooklyn, NY (${data.series.wf7YrArm.latest.date}) | ${wfArmMarket.toFixed(3)}% |`
    : null,
  wfArmEffective !== null
    ? `| **WF 7/6-Mo ARM Jumbo Effective (−${discount.toFixed(2)}% discount)** | **${wfArmEffective.toFixed(3)}%** |`
    : null,
  wfJumboMarket !== null
    ? `| Wells Fargo 30-Yr Fixed Jumbo — Brooklyn, NY (${data.series.wf30YrJumbo.latest.date}) | ${wfJumboMarket.toFixed(3)}% |`
    : null,
  wfJumboEffective !== null
    ? `| WF 30-Yr Fixed Jumbo Effective (−${discount.toFixed(2)}% discount) | ${wfJumboEffective.toFixed(3)}% |`
    : null,
  obJumboMarket !== null
    ? `| 30-Yr Fixed Jumbo Nat'l Index (${data.series.jumbo30.latest.date}) | ${obJumboMarket.toFixed(3)}% |`
    : null,
  `| Current note rate | ${noteRate.toFixed(3)}% |`,
  `| Alert threshold | ≤ ${alertAt.toFixed(3)}% |`,
].filter(Boolean);

const body = [
  `${mention}Mortgage rates in Brooklyn, NY (Kings County) have reached your refinance trigger.`,
  '',
  ...rows,
  '',
  'Open the dashboard → **Rate Watch & Refi Trigger** tab to review break-even and net benefit with your current closing-cost assumptions:',
  'https://jbaum86.github.io/bergen-arm-optimizer/',
].join('\n');

console.log(
  `Active benchmark (${series.label}): ${market.toFixed(3)}% − ${discount.toFixed(3)}% = ${effective.toFixed(3)}% effective → status: ${status}`
);
if (wfArmEffective !== null) {
  console.log(
    `  • WF 7/6-Mo ARM Jumbo (Brooklyn, NY): ${wfArmMarket.toFixed(3)}% base → ${wfArmEffective.toFixed(3)}% net (−${discount.toFixed(2)}%)`
  );
}
if (wfJumboEffective !== null) {
  console.log(
    `  • WF 30-Yr Fixed Jumbo (Brooklyn, NY): ${wfJumboMarket.toFixed(3)}% base → ${wfJumboEffective.toFixed(3)}% net (−${discount.toFixed(2)}%)`
  );
}

if (process.env.GITHUB_OUTPUT) {
  const delim = 'EOF_RATE_ALERT';
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `status=${status}\neffective=${effective.toFixed(3)}\nmarket=${market.toFixed(3)}\nbody<<${delim}\n${body}\n${delim}\n`
  );
}
