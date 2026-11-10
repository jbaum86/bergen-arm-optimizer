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
  benchmark: 'jumbo30',
  lenderQuote: null,
  lenderFees: 7500,
  includeRecordingTax: true,
  termMode: 'match',
  breakevenTargetMonths: 36,
  horizonMonths: 84,
};

const BENCHMARK_OPTIONS: { key: RateSeriesKey; label: string }[] = [
  { key: 'jumbo30', label: '30-Yr Fixed Jumbo' },
  { key: 'conforming30', label: '30-Yr Fixed Conforming' },
  { key: 'conforming15', label: '15-Yr Fixed Conforming' },
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
    const series = rates?.series[settings.benchmark] ?? null;
    const marketRate = settings.lenderQuote ?? series?.latest.value ?? null;
    const discount = settings.applyDiscount ? settings.relationshipDiscount : 0;
    const effectiveRate = marketRate !== null ? marketRate - discount : null;

    const termMonths = settings.termMode === 'match' ? position.remainingMonths : 360;
    const recordingTax = settings.includeRecordingTax ? position.balance * NYC_MORTGAGE_RECORDING_TAX_RATE : 0;
    const closingCosts = settings.lenderFees + recordingTax;
    const horizonMonths = Math.min(settings.horizonMonths, position.fixedMonthsLeft);

    const base = { balance: position.balance, termMonths, closingCosts, horizonMonths };
    const triggerEffective = solveTriggerRate(base, settings.breakevenTargetMonths) * 100; // percent
    const triggerMarket = triggerEffective + discount;

    const result = effectiveRate !== null ? analyzeRefi({ ...base, newRate: effectiveRate / 100 }) : null;
    const gap = effectiveRate !== null ? effectiveRate - triggerEffective : null; // pct points

    const status: Status = gap === null ? 'hold' : gap <= 0 ? 'refi' : gap <= 0.375 ? 'watch' : 'hold';

    return {
      position,
      series,
      marketRate,
      discount,
      effectiveRate,
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
    blurb: 'Effective rate is at or below your trigger — request a Wells Fargo quote.',
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
    blurb: 'Market rates remain well above the level where refinancing pays for itself.',
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <Stat label="Market Benchmark" value={a.marketRate !== null ? pct(a.marketRate) : '—'} />
          <Stat
            label={`WF Effective (−${a.discount.toFixed(2)}%)`}
            value={a.effectiveRate !== null ? pct(a.effectiveRate) : '—'}
            tone="text-blue-300"
          />
          <Stat label="Your Trigger" value={pct(a.triggerEffective)} tone="text-emerald-300" />
          <Stat
            label="Distance"
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

function Stat({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`font-mono-numbers text-base font-semibold ${tone}`}>{value}</div>
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

  // Build chart data on the benchmark's date grid, carrying forward weekly series
  const chartData = useMemo(() => {
    if (!data || !series) return [];
    const days = range === '6M' ? 182 : range === '1Y' ? 365 : 365 * 3;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const conf = data.series.conforming30?.points ?? [];
    const tsy = data.series.treasury10?.points ?? [];
    let ci = 0;
    let ti = 0;
    let lastConf: number | null = null;
    let lastTsy: number | null = null;
    const rows: Record<string, number | string | null>[] = [];
    const pts = series.points;
    const step = range === '3Y' ? 3 : 1;
    pts.forEach((p, i) => {
      while (ci < conf.length && conf[ci].date <= p.date) lastConf = conf[ci++].value;
      while (ti < tsy.length && tsy[ti].date <= p.date) lastTsy = tsy[ti++].value;
      if (p.date < cutoff) return;
      if (i % step !== 0 && i !== pts.length - 1) return;
      rows.push({
        date: p.date,
        benchmark: p.value,
        effective: Math.round((p.value - a.discount) * 1000) / 1000,
        conforming30: settings.benchmark === 'conforming30' ? null : lastConf,
        treasury10: lastTsy,
      });
    });
    return rows;
  }, [data, series, range, a.discount, settings.benchmark]);

  const generated = data ? new Date(data.generatedAt) : null;
  const benchLabel = BENCHMARK_OPTIONS.find((b) => b.key === settings.benchmark)?.label ?? 'Benchmark';

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Radar className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white tracking-tight">Rate Watch &amp; Refi Trigger</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Tracks live mortgage benchmarks, applies your Wells Fargo relationship discount, and tells you exactly how
            far rates must fall before refinancing your 5.750% ARM pays for itself.
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
                  {benchLabel} needs to fall from <strong>{pct(a.marketRate ?? 0)}</strong> to{' '}
                  <strong>{pct(a.triggerMarket)}</strong> (−{bps(a.gap)}) for your effective rate to hit the trigger.
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 text-slate-100">
            <Stat label={settings.lenderQuote !== null ? 'Lender Quote' : benchLabel} value={a.marketRate !== null ? pct(a.marketRate) : '—'} />
            <Stat label="Relationship Discount" value={`−${a.discount.toFixed(3)}%`} tone="text-blue-300" />
            <Stat label="Effective Refi Rate" value={a.effectiveRate !== null ? pct(a.effectiveRate) : '—'} tone="text-blue-200" />
            <Stat label="Trigger (Effective)" value={pct(a.triggerEffective)} tone="text-emerald-300" />
          </div>
        </div>
      </div>

      {/* Market tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {(['jumbo30', 'conforming30', 'conforming15', 'treasury10', 'sofr30'] as RateSeriesKey[]).map((k) => {
          const s = data?.series[k];
          const c = s ? changeOver(s.points, 7) : null;
          return (
            <div key={k} className="rounded-xl bg-white/5 border border-white/10 p-3.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 leading-tight min-h-[26px]">{s?.label ?? k}</div>
              <div className="font-mono-numbers text-lg font-semibold text-white mt-1">{s ? pct(s.latest.value) : '—'}</div>
              <div className="flex items-center justify-between text-[11px] mt-0.5">
                <span className="text-slate-500">{s?.latest.date ?? ''}</span>
                {c !== null && (
                  <span className={`flex items-center gap-0.5 ${c <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {c <= 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                    {c > 0 ? '+' : ''}
                    {Math.round(c * 100)}bp 1w
                  </span>
                )}
              </div>
            </div>
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
                {low52 && ` • 52-wk low ${pct(low52.value)} (${low52.date})`}
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
                  <Line type="monotone" dataKey="benchmark" name={benchLabel} stroke="#94a3b8" dot={false} strokeWidth={1.5} />
                  <Line type="monotone" dataKey="effective" name="WF Effective (w/ discount)" stroke="#3B82F6" dot={false} strokeWidth={2.25} />
                  {settings.benchmark !== 'conforming30' && (
                    <Line type="stepAfter" dataKey="conforming30" name="30-Yr Conforming" stroke="#a78bfa" dot={false} strokeWidth={1} strokeOpacity={0.7} />
                  )}
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
            <div className="text-xs text-slate-300">Market benchmark</div>
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
              <span>Actual lender quote (optional)</span>
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
              Include NYC mortgage recording tax (1.925%)
              <span className="block text-[10px] text-slate-500">{formatCurrency(a.position.balance * NYC_MORTGAGE_RECORDING_TAX_RATE, 0)} on current balance</span>
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
        <div className="rounded-2xl backdrop-blur-md bg-white/5 border border-white/10 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" /> If You Refinanced Today
          </h3>
          {a.result && a.effectiveRate !== null ? (
            <dl className="space-y-2 text-xs">
              <Row k="Payoff balance (est. today)" v={formatCurrency(a.position.balance)} />
              <Row k="Current P&I @ 5.750%" v={formatCurrency(BASELINE_LOAN.currentMonthlyPI)} />
              <Row k={`New P&I @ ${pct(a.effectiveRate)} / ${a.termMonths} mo`} v={formatCurrency(a.result.newPayment)} />
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
                  <th className="text-left py-2">Market</th>
                  <th className="text-left py-2">Effective</th>
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
          <Info className="w-3.5 h-3.5 text-blue-400" /> How the trigger works
        </div>
        <p>
          The trigger is the highest effective rate at which a refinance both (1) recovers closing costs within your break-even target and (2) leaves you
          wealthier by the end of your hold period, counting payment savings plus the difference in remaining balance. The hold period is capped at the
          remaining fixed term ({a.position.fixedMonthsLeft} months to the 09/01/2035 reset).
        </p>
        <p>
          Market data: {data?.source ?? 'FRED'} — Optimal Blue 30-yr jumbo (daily), Freddie Mac PMMS (weekly), 10-yr Treasury and 30-day SOFR. Published
          averages are a proxy; Wells Fargo&apos;s actual jumbo/ARM pricing can differ, so enter a real quote above when you have one.
        </p>
        <p className="flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-px" />
          <span>
            Email alerts: a GitHub Action re-checks rates every weekday and opens a GitHub issue (which emails you) when the effective rate drops to ≤{' '}
            {pct(data?.alertConfig.alertEffectiveRate ?? 5.0)}. Adjust that threshold in <code>scripts/rate-alert.config.json</code>.
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
