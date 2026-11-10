#!/usr/bin/env node
// Fetches:
// 1. Live Wells Fargo refinance rates specifically for Brooklyn, NY (Kings County,
//    FIPS 047, $1,390,000 home value, $1,090,000 mortgage balance) from Wells Fargo's
//    official home-lending pricing API, including:
//      • 7/6-Month ARM Jumbo
//      • 30-Year Fixed-Rate Jumbo
//      • 15-Year Fixed-Rate Jumbo
//      • 30-Year Fixed Rate (High-Balance Conforming)
// 2. Public mortgage & benchmark rate series from FRED (St. Louis Fed)
// and writes public/rates.json for the Rate Watch & Refi Trigger module.

import crypto from 'node:crypto';
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
    label: '30-Yr Fixed Jumbo (Optimal Blue Nat’l)',
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

async function fetchWellsFargoBrooklynRates(locCfg, discount) {
  const payload = {
    apiUrl: '/xapi/product-service-research/homelending-tools/v1/rates/refinance',
    type: 'refinance',
    home_value: String(locCfg.homeValue ?? 1390000),
    mortgage_balance: String(locCfg.mortgageBalance ?? 1090000),
    property_location: {
      city: locCfg.city ?? 'Brooklyn',
      state_code: locCfg.stateCode ?? 'NY',
      county: locCfg.county ?? 'Kings',
      fips_code: locCfg.fipsCode ?? '047',
    },
  };

  const headers = {
    'X-WF-REQUEST-DATE': new Date().toISOString(),
    'X-CORRELATION-ID': crypto.randomUUID(),
    'X-WF-CLIENT-ID': 'WU',
    'X-REQUEST-ID': crypto.randomUUID(),
    'Content-Type': 'application/json',
    Origin: 'https://www.wellsfargo.com',
    Referer: 'https://www.wellsfargo.com/mortgage/rates/',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  };

  const res = await fetch(
    'https://connect.secure.wellsfargo.com/xapi/product-service-research/homelending-tools/v1/rates/refinance',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) throw new Error(`Wells Fargo API HTTP ${res.status}`);
  const json = await res.json();
  const data = json?.data;
  if (!data || !Array.isArray(data.product_list) || data.product_list.length === 0) {
    throw new Error('Wells Fargo API returned empty product_list');
  }

  const today = isoDate(new Date());
  const products = data.product_list.map((p) => {
    const rate = Number(p.interest_rate);
    const eff = Math.round((rate - discount) * 1000) / 1000;
    return {
      productName: p.product_name,
      productType: p.product_type,
      loanType: p.loan_type,
      loanTerm: p.loan_term,
      loanAmount: Number(p.loan_amount),
      interestRate: rate,
      effectiveRate: eff,
      apr: Number(p.apr),
      monthlyPaymentAmount: Number(p.monthly_payment_amount),
      fullyIndexedRate: p.fully_indexed_interest_rate ? Number(p.fully_indexed_interest_rate) : null,
      firstAdjustmentPeriod: Number(p.first_adjustment_period ?? 0),
      discountPointsPercent: Number(p.discount_points_percent ?? 0),
      discountPointsAmount: Number(p.discount_points_amount ?? 0),
      closingCostAmount: Number(p.closing_cost_amount ?? 0),
      creditScore: Number(p.credit_score ?? 780),
    };
  });

  return {
    date: today,
    city: data.city ?? payload.property_location.city,
    county: data.county ?? payload.property_location.county,
    stateCode: data.state_code ?? payload.property_location.state_code,
    fipsCode: payload.property_location.fips_code,
    homeValue: Number(data.home_value ?? payload.home_value),
    mortgageBalance: Number(data.mortgage_balance ?? payload.mortgage_balance),
    timeStampMessage: data.time_stamp_message ?? '',
    relationshipDiscount: discount,
    products,
  };
}

function buildWfSeries({
  jumboPoints,
  existingPoints = [],
  liveRate,
  liveDate,
  quotedRate,
  fallbackSpread,
  discount,
  fredId,
  label,
}) {
  const effectiveTodayRate =
    typeof quotedRate === 'number'
      ? quotedRate
      : typeof liveRate === 'number'
        ? liveRate
        : null;

  const latestJumbo = jumboPoints[jumboPoints.length - 1]?.value ?? 7.0;
  const spread =
    effectiveTodayRate !== null
      ? Math.round((effectiveTodayRate - latestJumbo) * 1000) / 1000
      : fallbackSpread;

  // Preserve any recorded live WF observations by date
  const liveMap = new Map();
  for (const pt of existingPoints) {
    if (pt.live) liveMap.set(pt.date, pt.value);
  }
  if (effectiveTodayRate !== null && liveDate) {
    liveMap.set(liveDate, effectiveTodayRate);
  }

  const points = jumboPoints.map((p) => {
    if (liveMap.has(p.date)) {
      return { date: p.date, value: liveMap.get(p.date), live: true };
    }
    return {
      date: p.date,
      value: Math.round((p.value + spread) * 1000) / 1000,
    };
  });

  if (effectiveTodayRate !== null && liveDate && points[points.length - 1]?.date !== liveDate) {
    points.push({ date: liveDate, value: effectiveTodayRate, live: true });
  }

  const latest = points[points.length - 1];
  const effectiveLatest = {
    date: latest.date,
    value: Math.round((latest.value - discount) * 1000) / 1000,
  };

  return {
    fredId,
    label,
    frequency: 'daily',
    latest,
    effectiveLatest,
    relationshipDiscount: discount,
    spreadVsJumbo30: spread,
    points,
  };
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

  let existingData = null;
  try {
    existingData = JSON.parse(await readFile(OUT_FILE, 'utf8'));
  } catch {
    existingData = null;
  }

  const discount =
    typeof alertConfig.relationshipDiscount === 'number' ? alertConfig.relationshipDiscount : 0.5;

  // 1. Fetch live Wells Fargo Brooklyn / Kings County rates
  let wellsFargoBrooklyn = existingData?.wellsFargoBrooklyn ?? null;
  try {
    wellsFargoBrooklyn = await fetchWellsFargoBrooklynRates(
      alertConfig.wellsFargoBrooklyn ?? {},
      discount
    );
    const armProd = wellsFargoBrooklyn.products.find((p) =>
      p.productName.toLowerCase().includes('7/6')
    );
    const fixedJumboProd = wellsFargoBrooklyn.products.find(
      (p) => p.productName.toLowerCase().includes('30-year') && p.productName.toLowerCase().includes('jumbo')
    );
    console.log(
      `✓ Wells Fargo Live (${wellsFargoBrooklyn.city}, ${wellsFargoBrooklyn.stateCode} / ${wellsFargoBrooklyn.county} County):`
    );
    if (armProd) {
      console.log(
        `  • ${armProd.productName}: ${armProd.interestRate.toFixed(3)}% base (${armProd.apr.toFixed(3)}% APR) → ${armProd.effectiveRate.toFixed(3)}% net (−${discount.toFixed(2)}% WF discount)`
      );
    }
    if (fixedJumboProd) {
      console.log(
        `  • ${fixedJumboProd.productName}: ${fixedJumboProd.interestRate.toFixed(3)}% base (${fixedJumboProd.apr.toFixed(3)}% APR) → ${fixedJumboProd.effectiveRate.toFixed(3)}% net (−${discount.toFixed(2)}% WF discount)`
      );
    }
  } catch (err) {
    console.warn(`⚠ Wells Fargo Brooklyn live fetch failed (${err.message}); falling back to prior snapshot/spread.`);
  }

  // 2. Fetch FRED historical series
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

    if (series.jumbo30) {
      const armCfg = alertConfig.wf7YrArm ?? {};
      const liveArm = wellsFargoBrooklyn?.products?.find((p) =>
        p.productName.toLowerCase().includes('7/6')
      );
      series.wf7YrArm = buildWfSeries({
        jumboPoints: series.jumbo30.points,
        existingPoints: existingData?.series?.wf7YrArm?.points ?? [],
        liveRate: liveArm?.interestRate ?? null,
        liveDate: wellsFargoBrooklyn?.date ?? null,
        quotedRate: typeof armCfg.quotedBaseRate === 'number' ? armCfg.quotedBaseRate : null,
        fallbackSpread: typeof armCfg.spreadVsJumbo30 === 'number' ? armCfg.spreadVsJumbo30 : -0.469,
        discount: typeof armCfg.relationshipDiscount === 'number' ? armCfg.relationshipDiscount : discount,
        fredId: 'WF_BROOKLYN_7_6_ARM_JUMBO',
        label: armCfg.label ?? 'WF 7/6-Mo ARM Jumbo (Brooklyn, NY)',
      });

      const jumboCfg = alertConfig.wf30YrJumbo ?? {};
      const liveJumbo = wellsFargoBrooklyn?.products?.find(
        (p) => p.productName.toLowerCase().includes('30-year') && p.productName.toLowerCase().includes('jumbo')
      );
      series.wf30YrJumbo = buildWfSeries({
        jumboPoints: series.jumbo30.points,
        existingPoints: existingData?.series?.wf30YrJumbo?.points ?? [],
        liveRate: liveJumbo?.interestRate ?? null,
        liveDate: wellsFargoBrooklyn?.date ?? null,
        quotedRate: typeof jumboCfg.quotedBaseRate === 'number' ? jumboCfg.quotedBaseRate : null,
        fallbackSpread: typeof jumboCfg.spreadVsJumbo30 === 'number' ? jumboCfg.spreadVsJumbo30 : 0.406,
        discount: typeof jumboCfg.relationshipDiscount === 'number' ? jumboCfg.relationshipDiscount : discount,
        fredId: 'WF_BROOKLYN_30YR_FIXED_JUMBO',
        label: jumboCfg.label ?? 'WF 30-Yr Fixed Jumbo (Brooklyn, NY)',
      });
    }
  } catch (err) {
    console.warn(`⚠ Rate fetch failed (${err.message}). Keeping existing public/rates.json.`);
    process.exit(0);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'Wells Fargo Home Lending (Brooklyn / Kings County, NY) & St. Louis Fed (FRED)',
    alertConfig,
    wellsFargoBrooklyn,
    series,
  };

  await writeFile(OUT_FILE, JSON.stringify(payload));
  console.log(`Wrote ${OUT_FILE}`);
}

main();
