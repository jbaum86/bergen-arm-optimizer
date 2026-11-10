import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';
import {
  Radar,
  BellRing,
  BadgePercent,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Info,
  Target,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import { useRates } from '../hooks/useRates';
import type { RatesPayload, RateSeriesKey, RatePoint } from '../hooks/useRates';
import { BASELINE_LOAN } from '../constants/financialData';
import { formatCurrency } from '../utils/financialCalculations';
import {
  analyzeRefi,
  solveTriggerRate,
  currentLoanPosition,
  NYC_MORTGAGE_RECORDING_TAX_RATE,
} from '../utils/refiCalculations';

// ─────────────────────────────────────────────────────────────────────────────
// Settings (persisted in localStorage by App)
// ─────────────────────────────────────────────────────────────────────────────
export interface RefiSettings {
  relationshipDiscount: number; // percentage points, e.g. 0.5
  applyDiscount: boolean;
  benchmark: RateSeriesKey;
  lenderQuote: number | null; // optional manual all-in quote (percent, pre-discount)
  lenderFees: number;
  includeRecordingTax: boolean;
  termMode: 'match' | '30yr';
  breakevenTargetMonths: number;
  horizonMonths: number;
}

export const DEFAULT_REFI_SETTINGS: RefiSettings = {
  relationshipDiscount: 0.5,
  applyDiscount: true,
  benchmark: 'wf7YrArm',
  lenderQuote: null,
  lenderFees: 7500,
  includeRecordingTax: false, // same-lender WF refi: recording tax applies only to new money (none on a rate/term refi)
  termMode: 'match',
  breakevenTargetMonths: 36,
  horizonMonths: 84,
};

const BENCHMARK_OPTIONS: { key: RateSeriesKey; label: string }[] = [
  { key: 'wf7YrArm', label: 'WF 7/6-Mo ARM Jumbo (Brooklyn, NY)' },
  { key: 'wf30YrJumbo', label: 'WF 30-Yr Fixed Jumbo (Brooklyn, NY)' },
  { key: 'jumbo30', label: '30-Yr Fixed Jumbo (Optimal Blue Nat’l)' },
  { key: 'conforming30', label: '30-Yr Fixed Conforming (Freddie Mac)' },
  { key: 'conforming15', label: '15-Yr Fixed Conforming (Freddie Mac)' },
];

const pct = (v: number, d = 3) => `${v.toFixed(d)}%`;
const bps = (v: number) => `${Math.round(v * 100)} bps`;

function changeOver(points: RatePoint[], days: number): number | null {
  if (points.length < 2) return null;
  const latest = points[points.length - 1];
  const cutoff = new Date(new Date(latest.date).getTime() - days * 86400000).toISOString().slice(0, 10);
  const prior = [...points].reverse().find((p) => p.date <= cutoff);
  return prior ? latest.value - prior.value : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared analysis
// ─────────────────────────────────────────────────────────────────────────────
type Status = 'refi' | 'watch' | 'hold';

function useRefiAnalysis(settings: RefiSettings, rates: RatesPayload | null) {
  return useMemo(() => {
    const position = currentLoanPosition();
    const series = rates?.series[settings.benchmark] ?? rates?.series.jumbo30 ?? null;
    const marketRate = settings.lenderQuote ?? series?.latest.value ?? null;
    const discount = settings.applyDiscount ? settings.relationshipDiscount : 0;
    const effectiveRate = marketRate !== null ? marketRate - discount : null;

    // Explicit Brooklyn Wells Fargo 7/6 ARM Jumbo & 30-Yr Fixed Jumbo rates
    const wf7ArmBase = rates?.series.wf7YrArm?.latest.value ?? null;
    const wf7ArmEffective = wf7ArmBase !== null ? wf7ArmBase - discount : null;
    const wf30JumboBase = rates?.series.wf30YrJumbo?.latest.value ?? rates?.series.jumbo30?.latest.value ?? null;
    const wf30JumboEffective = wf30JumboBase !== null ? wf30JumboBase - discount : null;

    const termMonths = settings.termMode === 'match' ? position.remainingMonths : 360;
    const recordingTax = settings.includeRecordingTax ? position.balance * NYC_MORTGAGE_RECORDING_TAX_RATE : 0;
    const closingCosts = settings.lenderFees + recordingTax;
    const horizonMonths = Math.min(settings.horizonMonths, position.fixedMonthsLeft);

    const base = { balance: position.balance, termMonths, closingCosts, horizonMonths };
    const triggerEffective = solveTriggerRate(base, settings.breakevenTargetMonths) * 100; // percent
    const triggerMarket = triggerEffective + discount;

    const result = effectiveRate !== null ? analyzeRefi({ ...base, newRate: effectiveRate / 100 }) : null;
    const wf7ArmResult = wf7ArmEffective !== null ? analyzeRefi({ ...base, newRate: wf7ArmEffective / 100 }) : null;
    const wf30JumboResult = wf30JumboEffective !== null ? analyzeRefi({ ...base, newRate: wf30JumboEffective / 100 }) : null;

    const gap = effectiveRate !== null ? effectiveRate - triggerEffective : null; // pct points

    const status: Status = gap === null ? 'hold' : gap <= 0 ? 'refi' : gap <= 0.375 ? 'watch' : 'hold';

    return {
      position,
      series,
      marketRate,
      discount,
      effectiveRate,
      wf7ArmBase,
      wf7ArmEffective,
      wf7ArmResult,
      wf30JumboBase,
      wf30JumboEffective,
      wf30JumboResult,
      termMonths,
      recordingTax,
      closingCosts,
      horizonMonths,
      triggerEffective,
      triggerMarket,
      result,
      gap,
      status,
    };
  }, [settings, rates]);
}

const STATUS_META: Record<Status, { label: string; tone: string; dot: string; blurb: string }> = {
  refi: {
    label: 'Refi Zone',
    tone: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    dot: 'bg-emerald-400',
    blurb: 'Effective rate in Brooklyn, NY is at or below your trigger — request a Wells Fargo lock.',
  },
  watch: {
    label: 'Watch Closely',
    tone: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    dot: 'bg-amber-400',
    blurb: 'Within 37.5 bps of your trigger — a modest rally could open the window.',
  },
  hold: {
    label: 'Hold — Keep 5.750%',
    tone: 'bg-red-500/10 text-red-300 border-red-500/30',
    dot: 'bg-red-400',
    blurb: 'Brooklyn / NYC jumbo rates remain above the level where refinancing pays for itself.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Compact Command Center card
// ─────────────────────────────────────────────────────────────────────────────
export function RateWatchSummaryCard({
  settings,
  onOpen,
}: {
  settings: RefiSettings;
  onOpen: () => void;
}) {
  const { data, loading, error } = useRates();
  const a = useRefiAnalysis(settings, data);
  const meta = STATUS_META[a.status];

  return (
    <div className="rounded-2xl backdrop-blur-md bg-white/5 border border-white/10 p-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <Radar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-white">Rate Watch &amp; Refi Trigger</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                <MapPin className="w-3 h-3" /> Brooklyn / Kings County, NY
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.tone}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} animate-pulse`} />
                {meta.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {loading ? 'Loading market rates…' : error ? `Rate feed unavailable (${error})` : meta.blurb}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
          <Stat
            label={`WF 7/6 ARM (−${a.discount.toFixed(2)}%)`}
            value={a.wf7ArmEffective !== null ? pct(a.wf7ArmEffective) : '—'}
            sub={a.wf7ArmBase !== null ? `Brooklyn ${pct(a.wf7ArmBase)}` : undefined}
            tone="text-blue-300"
          />
          <Stat
            label={`WF 30Y Jumbo (−${a.discount.toFixed(2)}%)`}
            value={a.wf30JumboEffective !== null ? pct(a.wf30JumboEffective) : '—'}
            sub={a.wf30JumboBase !== null ? `Brooklyn ${pct(a.wf30JumboBase)}` : undefined}
            tone="text-slate-200"
          />
          <Stat label="Your Note Rate" value="5.750%" tone="text-amber-300" />
          <Stat label="Your Trigger" value={pct(a.triggerEffective)} tone="text-emerald-300" />
          <Stat
            label="7/6 ARM Distance"
            value={a.gap === null ? '—' : a.gap <= 0 ? 'In zone' : `${bps(a.gap)} to go`}
            tone={a.status === 'refi' ? 'text-emerald-300' : a.status === 'watch' ? 'text-amber-300' : 'text-red-300'}
          />
        </div>

        <button
          onClick={onOpen}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer whitespace-nowrap"
        >
          Open Rate Watch <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = 'text-white',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`font-mono-numbers text-base font-semibold ${tone}`}>{value}</div>
      {sub && <div className="text-[10px] font-mono-numbers text-slate-500">{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Full module
// ─────────────────────────────────────────────────────────────────────────────
export function ModuleRateWatch({
  settings,
  setSettings,
}: {
  settings: RefiSettings;
  setSettings: (s: RefiSettings) => void;
}) {
  const { data, loading, error } = useRates();
  const a = useRefiAnalysis(settings, data);
  const meta = STATUS_META[a.status];
  const [range, setRange] = useState<'6M' | '1Y' | '3Y'>('1Y');

  const update = <K extends keyof RefiSettings>(key: K, value: RefiSettings[K]) =>
    setSettings({ ...settings, [key]: value });

  const series = a.series;
  const chg7 = series ? changeOver(series.points, 7) : null;
  const chg30 = series ? changeOver(series.points, 30) : null;
  const low52 = series
    ? series.points
        .filter((p) => p.date >= new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10))
        .reduce<RatePoint | null>((m, p) => (!m || p.value < m.value ? p : m), null)
    : null;

  // Build chart data on the benchmark's date grid
  const chartData = useMemo(() => {
    if (!data || !series) return [];
    const days = range === '6M' ? 182 : range === '1Y' ? 365 : 365 * 3;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const armPts = data.series.wf7YrArm?.points ?? [];
    const wfJumboPts = data.series.wf30YrJumbo?.points ?? data.series.jumbo30?.points ?? [];
    const tsy = data.series.treasury10?.points ?? [];
    let ai = 0;
    let ji = 0;
    let ti = 0;
    let lastArm: number | null = null;
    let lastJumbo: number | null = null;
    let lastTsy: number | null = null;
    const rows: Record<string, number | string | null>[] = [];
    const pts = series.points;
    const step = range === '3Y' ? 3 : 1;
    pts.forEach((p, i) => {
      while (ai < armPts.length && armPts[ai].date <= p.date) lastArm = armPts[ai++].value;
      while (ji < wfJumboPts.length && wfJumboPts[ji].date <= p.date) lastJumbo = wfJumboPts[ji++].value;
      while (ti < tsy.length && tsy[ti].date <= p.date) lastTsy = tsy[ti++].value;
      if (p.date < cutoff) return;
      if (i % step !== 0 && i !== pts.length - 1) return;
      rows.push({
        date: p.date,
        benchmark: p.value,
        wf7ArmNet: lastArm !== null ? Math.round((lastArm - a.discount) * 1000) / 1000 : null,
        wf30JumboNet: lastJumbo !== null ? Math.round((lastJumbo - a.discount) * 1000) / 1000 : null,
        treasury10: lastTsy,
      });
    });
    return rows;
  }, [data, series, range, a.discount]);

  const generated = data ? new Date(data.generatedAt) : null;
  const benchLabel = BENCHMARK_OPTIONS.find((b) => b.key === settings.benchmark)?.label ?? 'Benchmark';
  const wfBk = data?.wellsFargoBrooklyn ?? null;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Radar className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white tracking-tight">Rate Watch &amp; Refi Trigger</h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
              <MapPin className="w-3.5 h-3.5" /> Brooklyn, NY (Kings County)
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Pulls live Wells Fargo refinance rates specifically priced for <strong>Brooklyn, NY (Kings County)</strong>{' '}
            at a <strong>$1.39M</strong> property value and <strong>$1.09M</strong> loan balance, applies your{' '}
            <strong>−{a.discount.toFixed(2)}%</strong> relationship discount, and tracks distance to your refi trigger.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <RefreshCw className="w-3.5 h-3.5" />
          {generated
            ? `Data refreshed ${generated.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} • auto-updates every weekday`
            : loading
              ? 'Loading…'
              : `Feed error: ${error}`}
        </div>
      </div>

      {/* Status hero */}
      <div className={`rounded-2xl border p-5 backdrop-blur-md ${meta.tone}`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-start gap-3">
            <BellRing className="w-6 h-6 mt-0.5 shrink-0" />
            <div>
              <div className="text-lg font-bold">{meta.label}</div>
              <p className="text-sm opacity-90">{meta.blurb}</p>
              {a.gap !== null && a.gap > 0 && (
                <p className="text-xs mt-1 opacity-80">
                  {benchLabel} base rate needs to fall from <strong>{pct(a.marketRate ?? 0)}</strong> to{' '}
                  <strong>{pct(a.triggerMarket)}</strong> (−{bps(a.gap)}) so your discounted rate hits{' '}
                  <strong>{pct(a.triggerEffective)}</strong>.
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-5 text-slate-100">
            <Stat
              label="WF 7/6 ARM (Brooklyn)"
              value={a.wf7ArmBase !== null ? pct(a.wf7ArmBase) : '—'}
              sub="0.000 pts • 780 FICO"
            />
            <Stat
              label={`WF 7/6 ARM (−${a.discount.toFixed(2)}%)`}
              value={a.wf7ArmEffective !== null ? pct(a.wf7ArmEffective) : '—'}
              sub="After WF discount"
              tone="text-blue-200"
            />
            <Stat
              label={`WF 30Y Jumbo (−${a.discount.toFixed(2)}%)`}
              value={a.wf30JumboEffective !== null ? pct(a.wf30JumboEffective) : '—'}
              sub={a.wf30JumboBase !== null ? `Brooklyn ${pct(a.wf30JumboBase)}` : undefined}
              tone="text-slate-200"
            />
            <Stat label="Trigger (Effective)" value={pct(a.triggerEffective)} tone="text-emerald-300" />
            <Stat
              label="Distance (Active)"
              value={a.gap === null ? '—' : a.gap <= 0 ? 'In zone' : `${bps(a.gap)} to go`}
              tone={a.status === 'refi' ? 'text-emerald-300' : a.status === 'watch' ? 'text-amber-300' : 'text-red-300'}
            />
          </div>
        </div>
      </div>

      {/* Live Wells Fargo Brooklyn, NY Quote Sheet */}
      {wfBk && wfBk.products.length > 0 && (
        <div className="rounded-2xl backdrop-blur-md bg-white/5 border border-white/10 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                Wells Fargo Live Refinance Rates — {wfBk.city}, {wfBk.stateCode} ({wfBk.county} County)
              </h3>
              <p className="text-[11px] text-slate-400">
                Scenario: {formatCurrency(wfBk.homeValue, 0)} home value • {formatCurrency(wfBk.mortgageBalance, 0)}{' '}
                loan balance • {wfBk.timeStampMessage.split('.')[0]}
              </p>
            </div>
            <span className="text-[11px] font-mono-numbers px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300">
              Relationship Discount Applied: −{a.discount.toFixed(2)}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {wfBk.products
              .filter((p) => p.loanType === 'CONVENTIONAL')
              .map((p) => {
                const netRate = Math.round((p.interestRate - a.discount) * 1000) / 1000;
                const seriesMatch: RateSeriesKey | null = p.productName.toLowerCase().includes('7/6')
                  ? 'wf7YrArm'
                  : p.productName.toLowerCase().includes('30-year') && p.productName.toLowerCase().includes('jumbo')
                    ? 'wf30YrJumbo'
                    : null;
                const isSelected = seriesMatch !== null && settings.benchmark === seriesMatch;
                return (
                  <div
                    key={p.productName}
                    onClick={() => {
                      if (seriesMatch) {
                        update('benchmark', seriesMatch);
                        update('lenderQuote', null);
                      } else {
                        update('lenderQuote', p.interestRate);
                      }
                    }}
                    className={`rounded-xl p-3.5 border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-500/15 border-blue-500/50 ring-1 ring-blue-500/30'
                        : 'bg-slate-900/60 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white">{p.productName}</span>
                      <span className="text-[10px] text-slate-400 font-mono-numbers">{p.creditScore} FICO</span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <div>
                        <div className="text-[10px] uppercase text-slate-400">Net w/ −{a.discount.toFixed(2)}% WF</div>
                        <div className="font-mono-numbers text-xl font-bold text-blue-300">{pct(netRate)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase text-slate-500">Published Base</div>
                        <div className="font-mono-numbers text-sm font-medium text-slate-300">{pct(p.interestRate)}</div>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-mono-numbers">
                      <span>APR {pct(p.apr, 3)}</span>
                      <span>{p.discountPointsPercent.toFixed(3)} pts</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Market Benchmark Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {(['wf7YrArm', 'wf30YrJumbo', 'jumbo30', 'conforming30', 'treasury10', 'sofr30'] as RateSeriesKey[]).map((k) => {
          const s = data?.series[k];
          const c = s ? changeOver(s.points, 7) : null;
          const isDiscountedProduct = k === 'wf7YrArm' || k === 'wf30YrJumbo' || k === 'jumbo30';
          const netVal = s && isDiscountedProduct ? Math.round((s.latest.value - a.discount) * 1000) / 1000 : null;
          const isSelected = settings.benchmark === k;
          return (
            <button
              type="button"
              key={k}
              onClick={() => {
                if (BENCHMARK_OPTIONS.some((b) => b.key === k)) {
                  update('benchmark', k);
                }
              }}
              className={`text-left rounded-xl p-3.5 border transition-all ${
                isSelected
                  ? 'bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/30'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              } ${BENCHMARK_OPTIONS.some((b) => b.key === k) ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-400 leading-tight min-h-[26px]">
                {s?.label ?? k}
              </div>
              <div className="font-mono-numbers text-lg font-semibold text-white mt-1">
                {s ? pct(s.latest.value) : '—'}
              </div>
              {netVal !== null && (
                <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-[10px] font-mono-numbers font-semibold text-blue-300">
                  Net {pct(netVal)} (−{a.discount.toFixed(2)}%)
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] mt-1">
                <span className="text-slate-500">{s?.latest.date ?? ''}</span>
                {c !== null && (
                  <span className={`flex items-center gap-0.5 ${c <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {c <= 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                    {c > 0 ? '+' : ''}
                    {Math.round(c * 100)}bp 1w
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="xl:col-span-2 rounded-2xl backdrop-blur-md bg-white/5 border border-white/10 p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white">Rate History vs. Your Note &amp; Trigger</h3>
              <p className="text-[11px] text-slate-400">
                {chg7 !== null && `1-wk ${chg7 > 0 ? '+' : ''}${Math.round(chg7 * 100)}bp`}
                {chg30 !== null && ` • 1-mo ${chg30 > 0 ? '+' : ''}${Math.round(chg30 * 100)}bp`}
                {low52 && ` • 52-wk low ${pct(low52.value)} base / ${pct(low52.value - a.discount)} net (${low52.date})`}
              </p>
            </div>
            <div className="flex rounded-lg bg-slate-900/70 border border-white/10 p-0.5">
              {(['6M', '1Y', '3Y'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-2.5 py-1 text-[11px] rounded-md cursor-pointer ${range === r ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="h-80">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={(d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                    minTickGap={40}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={{ background: '#0B0F19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(v) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(3)}%`)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={5.75} stroke="#F59E0B" strokeDasharray="6 4" label={{ value: 'Your note 5.750%', fill: '#F59E0B', fontSize: 10, position: 'insideTopLeft' }} />
                  <ReferenceLine y={a.triggerEffective} stroke="#10B981" strokeDasharray="4 4" label={{ value: `Trigger ${a.triggerEffective.toFixed(2)}%`, fill: '#10B981', fontSize: 10, position: 'insideBottomLeft' }} />
                  <Line type="monotone" dataKey="wf7ArmNet" name={`WF 7/6 ARM Brooklyn Net (−${a.discount.toFixed(2)}%)`} stroke="#3B82F6" dot={false} strokeWidth={2.5} />
                  <Line type="monotone" dataKey="wf30JumboNet" name={`WF 30Y Jumbo Brooklyn Net (−${a.discount.toFixed(2)}%)`} stroke="#a78bfa" dot={false} strokeWidth={1.75} />
                  <Line type="monotone" dataKey="benchmark" name={`${benchLabel} (Pre-Discount)`} stroke="#94a3b8" dot={false} strokeWidth={1.25} strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="treasury10" name="10-Yr Treasury" stroke="#64748b" dot={false} strokeWidth={1} strokeDasharray="2 3" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                {loading ? 'Loading rate history…' : 'No rate history available.'}
              </div>
            )}
          </div>
        </div>

        {/* Assumptions */}
        <div className="rounded-2xl backdrop-blur-md bg-white/5 border border-white/10 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <BadgePercent className="w-4 h-4 text-blue-400" /> Refi Assumptions
          </h3>

          <label className="flex items-center justify-between text-xs text-slate-300">
            <span>Wells Fargo relationship discount</span>
            <input type="checkbox" checked={settings.applyDiscount} onChange={(e) => update('applyDiscount', e.target.checked)} className="cursor-pointer" />
          </label>
          <NumberField
            label="Discount (percentage points)"
            value={settings.relationshipDiscount}
            step={0.125}
            min={0}
            max={2}
            disabled={!settings.applyDiscount}
            onChange={(v) => update('relationshipDiscount', v)}
            suffix="%"
          />

          <div className="space-y-1">
            <div className="text-xs text-slate-300">Primary refi product / benchmark</div>
            <select
              value={settings.benchmark}
              onChange={(e) => update('benchmark', e.target.value as RateSeriesKey)}
              className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-2.5 py-2 text-xs text-white"
            >
              {BENCHMARK_OPTIONS.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-300 flex items-center justify-between">
              <span>Custom rate override (optional)</span>
              {settings.lenderQuote !== null && (
                <button onClick={() => update('lenderQuote', null)} className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer">
                  clear
                </button>
              )}
            </div>
            <input
              type="number"
              step={0.125}
              placeholder="e.g. 6.250 (before discount)"
              value={settings.lenderQuote ?? ''}
              onChange={(e) => update('lenderQuote', e.target.value === '' ? null : Number(e.target.value))}
              className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-2.5 py-2 text-xs text-white font-mono-numbers placeholder-slate-600"
            />
          </div>

          <NumberField label="Lender, title & legal fees" value={settings.lenderFees} step={500} min={0} max={50000} onChange={(v) => update('lenderFees', v)} prefix="$" />

          <label className="flex items-start justify-between gap-3 text-xs text-slate-300">
            <span>
              Charge NYC mortgage recording tax (1.925%)
              <span className="block text-[10px] text-slate-500">
                Off by default — a same-lender Wells Fargo rate/term refi carries no recording tax on the existing balance. Turn on only to model
                switching lenders without an assignment ({formatCurrency(a.position.balance * NYC_MORTGAGE_RECORDING_TAX_RATE, 0)}).
              </span>
            </span>
            <input type="checkbox" checked={settings.includeRecordingTax} onChange={(e) => update('includeRecordingTax', e.target.checked)} className="cursor-pointer mt-0.5" />
          </label>

          <div className="space-y-1">
            <div className="text-xs text-slate-300">New loan term</div>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-900/70 border border-white/10 p-0.5">
              {(
                [
                  ['match', `Match ${a.position.remainingMonths} mo`],
                  ['30yr', 'New 30-yr'],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => update('termMode', k)}
                  className={`px-2 py-1.5 text-[11px] rounded-md cursor-pointer ${settings.termMode === k ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <RangeField
            label="Break-even target"
            value={settings.breakevenTargetMonths}
            min={12}
            max={84}
            step={6}
            onChange={(v) => update('breakevenTargetMonths', v)}
            display={`${settings.breakevenTargetMonths} mo`}
          />
          <RangeField
            label="Expected hold period"
            value={settings.horizonMonths}
            min={24}
            max={a.position.fixedMonthsLeft}
            step={6}
            onChange={(v) => update('horizonMonths', v)}
            display={`${a.horizonMonths} mo (${(a.horizonMonths / 12).toFixed(1)} yrs)`}
          />
        </div>
      </div>

      {/* Economics at current effective rate + ladder */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="rounded-2xl backdrop-blur-md bg-white/5 border border-white/10 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" /> If You Refinanced Today (Brooklyn, NY)
          </h3>
          {a.result && a.effectiveRate !== null ? (
            <>
              <dl className="space-y-2 text-xs">
                <Row k="Payoff balance (est. today)" v={formatCurrency(a.position.balance)} />
                <Row k="Current P&I @ 5.750%" v={formatCurrency(BASELINE_LOAN.currentMonthlyPI)} />
                <Row k={`Selected (${benchLabel.split(' (')[0]}) @ ${pct(a.effectiveRate)}`} v={formatCurrency(a.result.newPayment)} />
                <Row
                  k="Monthly cash-flow change"
                  v={`${a.result.monthlySavings >= 0 ? '+' : ''}${formatCurrency(a.result.monthlySavings)}`}
                  tone={a.result.monthlySavings >= 0 ? 'text-emerald-400' : 'text-red-400'}
                />
                <Row k="Total closing costs" v={formatCurrency(a.closingCosts, 0)} tone="text-red-300" />
                <Row
                  k="Break-even"
                  v={Number.isFinite(a.result.breakevenMonths) ? `${a.result.breakevenMonths.toFixed(1)} mo` : 'Never'}
                  tone={a.result.breakevenMonths <= settings.breakevenTargetMonths ? 'text-emerald-400' : 'text-red-400'}
                />
                <Row
                  k={`Net benefit after ${a.horizonMonths} mo`}
                  v={formatCurrency(a.result.netBenefitAtHorizon, 0)}
                  tone={a.result.netBenefitAtHorizon >= 0 ? 'text-emerald-400' : 'text-red-400'}
                />
              </dl>

              {a.wf7ArmResult && a.wf7ArmEffective !== null && a.wf30JumboResult && a.wf30JumboEffective !== null && (
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Brooklyn, NY Wells Fargo Comparison (w/ −{a.discount.toFixed(2)}% Discount)
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-2.5">
                      <div className="text-[10px] text-blue-300 font-medium">WF 7/6-Mo ARM Jumbo</div>
                      <div className="font-mono-numbers text-sm font-bold text-white mt-0.5">{pct(a.wf7ArmEffective)} net</div>
                      <div className="text-[10px] text-slate-400 font-mono-numbers">
                        P&amp;I: {formatCurrency(a.wf7ArmResult.newPayment, 0)}/mo
                      </div>
                      <div className={`text-[10px] font-mono-numbers ${a.wf7ArmResult.monthlySavings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {a.wf7ArmResult.monthlySavings >= 0 ? '+' : ''}
                        {formatCurrency(a.wf7ArmResult.monthlySavings, 0)}/mo vs now
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/5 border border-white/10 p-2.5">
                      <div className="text-[10px] text-slate-300 font-medium">WF 30-Yr Fixed Jumbo</div>
                      <div className="font-mono-numbers text-sm font-bold text-white mt-0.5">{pct(a.wf30JumboEffective)} net</div>
                      <div className="text-[10px] text-slate-400 font-mono-numbers">
                        P&amp;I: {formatCurrency(a.wf30JumboResult.newPayment, 0)}/mo
                      </div>
                      <div className={`text-[10px] font-mono-numbers ${a.wf30JumboResult.monthlySavings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {a.wf30JumboResult.monthlySavings >= 0 ? '+' : ''}
                        {formatCurrency(a.wf30JumboResult.monthlySavings, 0)}/mo vs now
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-500">Waiting for rate data…</p>
          )}
        </div>

        <div className="xl:col-span-2 rounded-2xl backdrop-blur-md bg-white/5 border border-white/10 p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Refinance Rate Ladder</h3>
          <p className="text-[11px] text-slate-400 mb-3">
            Effective rate after the {a.discount.toFixed(2)}% relationship discount. Green rows meet both your break-even target and positive net benefit.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                  <th className="text-left py-2">WF Base Rate</th>
                  <th className="text-left py-2">Effective (−{a.discount.toFixed(2)}%)</th>
                  <th className="text-right py-2">New P&amp;I</th>
                  <th className="text-right py-2">Monthly Δ</th>
                  <th className="text-right py-2">Break-even</th>
                  <th className="text-right py-2">Net @ {a.horizonMonths} mo</th>
                </tr>
              </thead>
              <tbody className="font-mono-numbers">
                {Array.from({ length: 14 }, (_, i) => {
                  const top = Math.ceil(Math.min(Math.max(a.effectiveRate ?? 5.625, a.triggerEffective + 0.75), 7.5) * 8) / 8;
                  return Math.round((top - i * 0.125) * 1000) / 1000;
                })
                  .map((eff) => {
                    const r = analyzeRefi({
                      balance: a.position.balance,
                      newRate: eff / 100,
                      termMonths: a.termMonths,
                      closingCosts: a.closingCosts,
                      horizonMonths: a.horizonMonths,
                    });
                    const ok = eff <= a.triggerEffective + 1e-9;
                    const isNow = a.effectiveRate !== null && Math.abs(eff - a.effectiveRate) < 0.0625;
                    return (
                      <tr key={eff} className={`border-b border-white/5 ${ok ? 'bg-emerald-500/5' : ''} ${isNow ? 'ring-1 ring-blue-500/50' : ''}`}>
                        <td className="py-1.5 text-slate-400">{pct(eff + a.discount)}</td>
                        <td className={`py-1.5 ${ok ? 'text-emerald-300' : 'text-slate-200'}`}>{pct(eff)}</td>
                        <td className="py-1.5 text-right text-slate-200">{formatCurrency(r.newPayment, 0)}</td>
                        <td className={`py-1.5 text-right ${r.monthlySavings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {r.monthlySavings >= 0 ? '+' : ''}
                          {formatCurrency(r.monthlySavings, 0)}
                        </td>
                        <td className="py-1.5 text-right text-slate-300">
                          {Number.isFinite(r.breakevenMonths) ? `${r.breakevenMonths.toFixed(0)} mo` : '—'}
                        </td>
                        <td className={`py-1.5 text-right ${r.netBenefitAtHorizon >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatCurrency(r.netBenefitAtHorizon, 0)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-2xl bg-slate-900/40 border border-white/5 p-4 text-[11px] text-slate-400 space-y-1.5">
        <div className="flex items-center gap-1.5 text-slate-300 font-medium">
          <Info className="w-3.5 h-3.5 text-blue-400" /> How the Brooklyn / NYC Wells Fargo rate feed &amp; trigger work
        </div>
        <p>
          <strong>Live Wells Fargo Brooklyn / Kings County Pricing:</strong> Every weekday, the automated workflow queries Wells Fargo&apos;s official
          home-lending pricing API specifically for <strong>Brooklyn, NY (Kings County, FIPS 36047)</strong> with a{' '}
          <strong>$1,390,000</strong> property value and <strong>$1,090,000</strong> loan balance (pulling the exact{' '}
          <code>7/6-Month ARM Jumbo</code>, <code>30-Year Fixed-Rate Jumbo</code>, and <code>15-Year Fixed-Rate Jumbo</code> rates), and then subtracts
          your <strong>{a.discount.toFixed(2)}%</strong> Wells Fargo relationship discount.
        </p>
        <p>
          The trigger is the highest effective rate at which a refinance both (1) recovers closing costs within your break-even target and (2) leaves you
          wealthier by the end of your hold period, counting payment savings plus the difference in remaining balance. The hold period is capped at the
          remaining fixed term ({a.position.fixedMonthsLeft} months to the 09/01/2035 reset).
        </p>
        <p className="flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-px" />
          <span>
            Email alerts: a GitHub Action re-checks Brooklyn Wells Fargo rates every weekday and opens a GitHub issue (which emails you) when the
            discounted effective rate drops to ≤ {pct(data?.alertConfig.alertEffectiveRate ?? 5.44)}. Location and alert settings live in{' '}
            <code>scripts/rate-alert.config.json</code>.
          </span>
        </p>
      </div>
    </div>
  );
}

function Row({ k, v, tone = 'text-slate-100' }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-1.5">
      <dt className="text-slate-400">{k}</dt>
      <dd className={`font-mono-numbers font-medium ${tone}`}>{v}</dd>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  min,
  max,
  prefix,
  suffix,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`space-y-1 ${disabled ? 'opacity-40' : ''}`}>
      <div className="text-xs text-slate-300">{label}</div>
      <div className="flex items-center rounded-lg bg-slate-900/80 border border-white/10 px-2.5">
        {prefix && <span className="text-xs text-slate-500 mr-1">{prefix}</span>}
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
          className="w-full bg-transparent py-2 text-xs text-white font-mono-numbers focus:outline-none"
        />
        {suffix && <span className="text-xs text-slate-500 ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono-numbers text-blue-300">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(value, max)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-500 cursor-pointer"
      />
    </div>
  );
}
