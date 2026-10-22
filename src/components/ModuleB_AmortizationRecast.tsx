// src/components/ModuleB_AmortizationRecast.tsx
import React from 'react';
import {
  Sliders,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import type {
  RecastMode,
  StrategySimulationResult,
  TaxProfile,
} from '../types/financial';
import {
  BASELINE_LOAN,
  PRESET_CURTAILMENTS,
  PRESET_EXTRA_MONTHLIES,
} from '../constants/financialData';
import {
  formatCurrency,
  formatPercent,
  calculatePmt,
  simulateAmortization,
} from '../utils/financialCalculations';

interface ModuleBProps {
  lumpSum: number;
  setLumpSum: (val: number) => void;
  extraMonthly: number;
  setExtraMonthly: (val: number) => void;
  recastMode: RecastMode;
  setRecastMode: (mode: RecastMode) => void;
  stopAt750k: boolean;
  setStopAt750k: (val: boolean) => void;
  resetRate: number;
  setResetRate: (val: number) => void;
  simulation: StrategySimulationResult;
  taxProfile: TaxProfile;
}

export const ModuleB_AmortizationRecast: React.FC<ModuleBProps> = ({
  lumpSum,
  setLumpSum,
  extraMonthly,
  setExtraMonthly,
  recastMode,
  setRecastMode,
  stopAt750k,
  setStopAt750k,
  resetRate,
  setResetRate,
  simulation,
  taxProfile,
}) => {
  // Compute Baseline Simulation for chart comparison
  const baselineSim = React.useMemo(() => {
    return simulateAmortization({
      lumpSum: 0,
      extraMonthly: 0,
      recastMode: 'no_recast',
      stopAt750k: false,
      resetRate: resetRate,
      taxProfile,
    });
  }, [resetRate, taxProfile]);

  // Downsample schedule for charting performance (sample every 6 months)
  const chartData = React.useMemo(() => {
    const data: {
      date: string;
      month: number;
      baselineBalance: number;
      strategyBalance: number;
    }[] = [];

    const totalPoints = Math.max(
      baselineSim.fullSchedule.length,
      simulation.fullSchedule.length
    );

    for (let i = 0; i < totalPoints; i += 6) {
      const bItem = baselineSim.fullSchedule[i] || baselineSim.fullSchedule[baselineSim.fullSchedule.length - 1];
      const sItem = simulation.fullSchedule[i] || simulation.fullSchedule[simulation.fullSchedule.length - 1];

      data.push({
        date: sItem.dateStr || bItem.dateStr,
        month: sItem.month || bItem.month,
        baselineBalance: Math.round(bItem?.balance || 0),
        strategyBalance: Math.round(sItem?.balance || 0),
      });
    }

    // Always include month 107 (09/2035) reset milestone
    if (!data.some((d) => d.month === 107)) {
      const b107 = baselineSim.fullSchedule[106];
      const s107 = simulation.fullSchedule[106];
      if (b107 && s107) {
        data.push({
          date: 'Sep 2035',
          month: 107,
          baselineBalance: Math.round(b107.balance),
          strategyBalance: Math.round(s107.balance),
        });
        data.sort((a, b) => a.month - b.month);
      }
    }

    return data;
  }, [baselineSim, simulation]);

  // Payment Shock Data for 2035 Reset
  const baselinePostResetPI = calculatePmt(baselineSim.endFixedBalance, resetRate, 240);
  const strategyPostResetPI = simulation.postResetMonthlyPI;
  const currentPI = BASELINE_LOAN.currentMonthlyPI;

  const paymentShockData = [
    {
      name: 'Today (2026 P&I)',
      amount: currentPI,
      category: 'Current Contractual',
      color: '#3B82F6', // Blue
    },
    {
      name: 'Baseline 2035 Reset',
      amount: baselinePostResetPI,
      category: 'Baseline Shock',
      color: '#EF4444', // Red
    },
    {
      name: 'Strategy 2035 Reset',
      amount: strategyPostResetPI,
      category: 'Strategy Reset',
      color: strategyPostResetPI <= currentPI ? '#10B981' : '#F59E0B', // Emerald or Amber
    },
  ];

  return (
    <div className="space-y-6">
      {/* Interactive Controls Section */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4 gap-2">
          <div className="flex items-center space-x-2.5">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              Principal Curtailment & Jumbo Recast Controls
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Real-time multi-variable sensitivity engine
          </span>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Control 1: Lump-Sum Principal Curtailment */}
          <div className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Lump-Sum Principal Curtailment
              </label>
              <span className="text-base font-bold font-mono-numbers text-blue-400">
                {formatCurrency(lumpSum)}
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={350000}
              step={1000}
              value={lumpSum}
              onChange={(e) => setLumpSum(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESET_CURTAILMENTS.map((p) => {
                const isSelected = Math.abs(lumpSum - p.value) < 1;
                return (
                  <button
                    key={p.label}
                    onClick={() => setLumpSum(p.value)}
                    className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold shadow-sm'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Control 2: Recurring Monthly Extra Principal */}
          <div className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Recurring Monthly Extra Principal
              </label>
              <span className="text-base font-bold font-mono-numbers text-emerald-400">
                {formatCurrency(extraMonthly)}/mo
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={5000}
              step={50}
              value={extraMonthly}
              onChange={(e) => setExtraMonthly(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESET_EXTRA_MONTHLIES.map((p) => {
                const isSelected = Math.abs(extraMonthly - p.value) < 1;
                return (
                  <button
                    key={p.label}
                    onClick={() => setExtraMonthly(p.value)}
                    className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Toggles & Reset Rate Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Wells Fargo Free Jumbo Recast Mode Selector */}
          <div className="lg:col-span-2 space-y-2.5 bg-white/[0.02] p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Wells Fargo $0-Fee Jumbo Recast Architecture
                </span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">
                Requires ≥$10k Curtailment
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* Option 1: No Recast */}
              <button
                onClick={() => setRecastMode('no_recast')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  recastMode === 'no_recast'
                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                    : 'bg-slate-900/40 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <div className="text-xs font-bold text-white mb-1">1. No Recast</div>
                <div className="text-[11px] leading-tight text-slate-300">
                  Maintain contractual $6,454.32/mo P&I. Maximum rapid debt & interest compression.
                </div>
              </button>

              {/* Option 2: Free Jumbo Recast */}
              <button
                onClick={() => setRecastMode('free_recast')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  recastMode === 'free_recast'
                    ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-md'
                    : 'bg-slate-900/40 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">2. Free Jumbo Recast</span>
                  <span className="text-[10px] text-emerald-400 font-mono font-semibold">Max Cashflow</span>
                </div>
                <div className="text-[11px] leading-tight text-slate-300">
                  Re-amortize over 347 months. Lowers required P&I (e.g. to $5,918.41/mo on $90.5k paydown).
                </div>
              </button>

              {/* Option 3: Hybrid Recast & Shadow-Pay */}
              <button
                onClick={() => setRecastMode('hybrid_shadow')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  recastMode === 'hybrid_shadow'
                    ? 'bg-purple-600/20 border-purple-500 text-white shadow-md'
                    : 'bg-slate-900/40 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">3. Hybrid "Shadow-Pay"</span>
                  <span className="text-[10px] text-purple-400 font-mono font-semibold">Recommended</span>
                </div>
                <div className="text-[11px] leading-tight text-slate-300">
                  Lock in lower required payment floor, but continue paying baseline $6,454.32 to preserve liquidity optionality.
                </div>
              </button>
            </div>
          </div>

          {/* Smart Toggle: Stop at $750k */}
          <div className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Stop-at-$750k Smart Logic
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    stopAt750k
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {stopAt750k ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automatically halts extra monthly principal payments once the loan drops below the $750k Federal cap to preserve tax-shielded arbitrage.
              </p>
            </div>

            <button
              onClick={() => setStopAt750k(!stopAt750k)}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center space-x-2 ${
                stopAt750k
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
              }`}
            >
              {stopAt750k ? <CheckCircle2 className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span>{stopAt750k ? 'Active: Halting at $750k' : 'Enable Stop at $750k'}</span>
            </button>
          </div>
        </div>

        {/* 2035 ARM Reset Rate Slider */}
        <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                September 1, 2035 ARM Reset Rate Stress-Tester (5/1/5 Caps)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Simulated Post-Reset Rate:</span>
              <span className="text-base font-bold font-mono-numbers text-amber-400">
                {formatPercent(resetRate)}
              </span>
            </div>
          </div>

          <input
            type="range"
            min={0.045}
            max={0.1075}
            step={0.0025}
            value={resetRate}
            onChange={(e) => setResetRate(Number(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
          />

          <div className="flex flex-wrap gap-2 pt-1 text-[11px] justify-between">
            <button
              onClick={() => setResetRate(0.0575)}
              className={`px-2 py-0.5 rounded cursor-pointer ${
                resetRate === 0.0575 ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              5.750% (No Change)
            </button>
            <button
              onClick={() => setResetRate(0.0700)}
              className={`px-2 py-0.5 rounded cursor-pointer ${
                resetRate === 0.0700 ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              7.000% (Moderate Reset)
            </button>
            <button
              onClick={() => setResetRate(0.0800)}
              className={`px-2 py-0.5 rounded cursor-pointer ${
                resetRate === 0.0800 ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              8.000% (Elevated Stress)
            </button>
            <button
              onClick={() => setResetRate(0.1075)}
              className={`px-2 py-0.5 rounded cursor-pointer ${
                resetRate === 0.1075 ? 'bg-red-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              10.750% (Max Lifetime Cap)
            </button>
          </div>
        </div>
      </div>

      {/* Dual Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Dual-Series Amortization Trajectory Chart (2026 to 2055) */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white">
                Amortization Trajectory (2026 – 2055)
              </h2>
              <p className="text-xs text-slate-400">
                Baseline vs Active Strategy against Federal ($750k), Conforming ($832.75k), and NY ($1.0M) caps.
              </p>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <span className="flex items-center space-x-1.5 text-slate-400">
                <span className="w-3 h-0.5 bg-slate-500 rounded" />
                <span>Baseline</span>
              </span>
              <span className="flex items-center space-x-1.5 text-blue-400">
                <span className="w-3 h-1 bg-blue-500 rounded" />
                <span>Strategy</span>
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="stratArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  stroke="#64748B"
                  fontSize={10}
                  tickLine={false}
                  interval={8}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={10}
                  tickLine={false}
                  domain={[0, 1150000]}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 border border-white/10 rounded-xl p-3 shadow-xl backdrop-blur-md text-xs space-y-1">
                          <div className="font-semibold text-white mb-1 border-b border-white/10 pb-1">
                            {label} (Month {data.month})
                          </div>
                          <div className="flex items-center justify-between space-x-4">
                            <span className="text-slate-400">Baseline Balance:</span>
                            <span className="font-mono text-slate-300">
                              {formatCurrency(data.baselineBalance)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between space-x-4">
                            <span className="text-blue-400 font-medium">Strategy Balance:</span>
                            <span className="font-mono text-blue-300 font-bold">
                              {formatCurrency(data.strategyBalance)}
                            </span>
                          </div>
                          {data.baselineBalance > data.strategyBalance && (
                            <div className="flex items-center justify-between space-x-4 pt-1 border-t border-white/5 text-emerald-400">
                              <span>Equity Acceleration:</span>
                              <span className="font-mono font-semibold">
                                +{formatCurrency(data.baselineBalance - data.strategyBalance)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine
                  y={1000000}
                  stroke="#F59E0B"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                  label={{ value: 'NY $1.0M Cap', fill: '#F59E0B', fontSize: 10, position: 'right' }}
                />
                <ReferenceLine
                  y={832750}
                  stroke="#8B5CF6"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                  label={{ value: '$832.75k Conforming', fill: '#8B5CF6', fontSize: 10, position: 'right' }}
                />
                <ReferenceLine
                  y={750000}
                  stroke="#10B981"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                  label={{ value: 'Fed $750k Cap', fill: '#10B981', fontSize: 10, position: 'right' }}
                />
                <Line
                  type="monotone"
                  dataKey="baselineBalance"
                  stroke="#64748B"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="strategyBalance"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  fill="url(#stratArea)"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: 2035 Payment Shock Comparison Bar Chart */}
        <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">2035 Reset Payment Shock</h2>
              <span className="text-[11px] font-mono text-amber-400 font-semibold">
                @ {formatPercent(resetRate)} Reset
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Required monthly P&I starting October 1, 2035 (remaining 240 months).
            </p>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={paymentShockData}
                margin={{ top: 15, right: 10, left: 10, bottom: 5 }}
              >
                <XAxis
                  dataKey="name"
                  stroke="#64748B"
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={10}
                  tickLine={false}
                  domain={[0, Math.max(10000, baselinePostResetPI * 1.15)]}
                  tickFormatter={(val) => `$${val.toLocaleString()}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      const diffVsCurrent = d.amount - currentPI;
                      return (
                        <div className="bg-slate-900/95 border border-white/10 rounded-xl p-3 shadow-xl backdrop-blur-md text-xs space-y-1">
                          <div className="font-semibold text-white">{d.name}</div>
                          <div className="font-mono text-base font-bold text-white">
                            {formatCurrency(d.amount)}/mo
                          </div>
                          <div className="text-[11px] text-slate-400 pt-1 border-t border-white/5">
                            Vs Current ($6,454.32):{' '}
                            <span
                              className={`font-semibold font-mono ${
                                diffVsCurrent <= 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {diffVsCurrent <= 0
                                ? `-$${Math.abs(diffVsCurrent).toFixed(2)}/mo`
                                : `+$${diffVsCurrent.toFixed(2)}/mo`}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                  {paymentShockData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-300">
              <span>Baseline 2035 Payment:</span>
              <span className="font-mono font-bold text-red-400">
                {formatCurrency(baselinePostResetPI)}/mo
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Strategy 2035 Payment:</span>
              <span className="font-mono font-bold text-emerald-400">
                {formatCurrency(strategyPostResetPI)}/mo
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-white/5 text-slate-400 text-[11px]">
              <span>Monthly Shock Deflated:</span>
              <span className="font-mono font-semibold text-emerald-400">
                {formatCurrency(baselinePostResetPI - strategyPostResetPI)}/mo
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
