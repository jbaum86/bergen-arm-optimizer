// src/components/ModuleB_AmortizationRecast.tsx
import { useMemo, useState, useEffect } from 'react';
import {
  Sliders,
  AlertCircle,
  CheckCircle2,
  Lock,
  TrendingDown,
  DollarSign,
  Calendar,
  Sparkles,
  Info,
  Check,
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
  LumpSumStrategyMode,
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
  strategyMode: LumpSumStrategyMode;
  setStrategyMode: (mode: LumpSumStrategyMode) => void;
  extraMonthly: number;
  setExtraMonthly: (val: number) => void;
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
  strategyMode,
  setStrategyMode,
  extraMonthly,
  setExtraMonthly,
  stopAt750k,
  setStopAt750k,
  resetRate,
  setResetRate,
  simulation,
  taxProfile,
}) => {
  const [shockScenarioRate, setShockScenarioRate] = useState<number>(resetRate);

  // Synchronize shock scenario rate with resetRate slider when resetRate changes
  useEffect(() => {
    setShockScenarioRate(resetRate);
  }, [resetRate]);

  // Baseline Simulation
  const baselineSim = useMemo(() => {
    return simulateAmortization({
      lumpSum: 0,
      extraMonthly: 0,
      strategyMode: 'maintain_flat',
      stopAt750k: false,
      resetRate: shockScenarioRate,
      taxProfile,
    });
  }, [shockScenarioRate, taxProfile]);

  // Mode A Simulation (Flat $6,454.32)
  const modeASim = useMemo(() => {
    return simulateAmortization({
      lumpSum,
      extraMonthly,
      strategyMode: 'maintain_flat',
      stopAt750k,
      resetRate: shockScenarioRate,
      taxProfile,
    });
  }, [lumpSum, extraMonthly, stopAt750k, shockScenarioRate, taxProfile]);

  // Mode B Simulation (Take Reduced Recast)
  const modeBSim = useMemo(() => {
    return simulateAmortization({
      lumpSum,
      extraMonthly,
      strategyMode: 'take_reduced',
      stopAt750k,
      resetRate: shockScenarioRate,
      taxProfile,
    });
  }, [lumpSum, extraMonthly, stopAt750k, shockScenarioRate, taxProfile]);

  // Downsample schedule for charting performance (sample every 6 months)
  const chartData = useMemo(() => {
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

    // Include month 107 (09/2035) reset milestone
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

  // Payment Shock Data for 2035 Reset Comparison
  const baselinePostResetPI = calculatePmt(baselineSim.endFixedBalance, shockScenarioRate, 240);
  const modeAPostResetPI = calculatePmt(modeASim.endFixedBalance, shockScenarioRate, 240);
  const modeBPostResetPI = calculatePmt(modeBSim.endFixedBalance, shockScenarioRate, 240);
  const currentPI = BASELINE_LOAN.currentMonthlyPI;

  const paymentShockComparisonData = [
    {
      name: 'Today (2026 P&I)',
      amount: currentPI,
      category: 'Current Contractual',
      color: '#3B82F6', // Blue
      sub: 'Contractual Reference',
    },
    {
      name: 'Baseline 2035',
      amount: baselinePostResetPI,
      category: 'No Action Taken',
      color: '#EF4444', // Red
      sub: `$919.3k Ending Bal`,
    },
    {
      name: 'Mode A (Maintain Flat)',
      amount: modeAPostResetPI,
      category: 'Max Reset Protection',
      color: modeAPostResetPI <= currentPI ? '#10B981' : '#F59E0B',
      sub: `${formatCurrency(modeASim.endFixedBalance, 0)} Bal`,
      isActive: strategyMode === 'maintain_flat',
    },
    {
      name: 'Mode B (Take Reduced)',
      amount: modeBPostResetPI,
      category: 'Immediate Cash Flow',
      color: modeBPostResetPI <= currentPI ? '#10B981' : '#F59E0B',
      sub: `${formatCurrency(modeBSim.endFixedBalance, 0)} Bal`,
      isActive: strategyMode === 'take_reduced',
    },
  ];

  const isRecastEligible = lumpSum >= 10000;
  const recastDiff = Math.max(0, BASELINE_LOAN.currentMonthlyPI - simulation.recastRequiredMonthlyPI);
  const isPostResetLowerThanToday = simulation.postResetMonthlyPI < currentPI;

  return (
    <div className="space-y-6">
      {/* 4 Live KPI Cards in Module B */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: New Contractual Required P&I */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5">
            <span>Contractual Required P&I</span>
            <DollarSign className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono-numbers text-white tracking-tight">
            {formatCurrency(simulation.recastRequiredMonthlyPI)}
            <span className="text-xs font-normal text-slate-400">/mo</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Original: <span className="font-mono text-slate-300">{formatCurrency(BASELINE_LOAN.currentMonthlyPI)}</span>
            </span>
            {isRecastEligible ? (
              <span className="text-emerald-400 font-mono font-semibold">
                -{formatCurrency(recastDiff)}/mo
              </span>
            ) : (
              <span className="text-slate-500 font-mono">No Recast (&lt;$10k)</span>
            )}
          </div>
        </div>

        {/* Card 2: Total Monthly Incremental Principal */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5">
            <span>Monthly Incremental Principal</span>
            <TrendingDown className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono-numbers text-emerald-400 tracking-tight">
            +{formatCurrency(simulation.totalMonthlyIncrementalPrincipal)}
            <span className="text-xs font-normal text-emerald-300/70">/mo</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 truncate">
            {strategyMode === 'maintain_flat' && isRecastEligible ? (
              <span>
                Recast Diff <span className="font-mono text-emerald-400">+{formatCurrency(simulation.recastIncrementalPrincipal)}</span> + Extra <span className="font-mono text-slate-300">+{formatCurrency(extraMonthly)}</span>
              </span>
            ) : (
              <span>
                Recurring Extra Slider: <span className="font-mono text-emerald-400">+{formatCurrency(extraMonthly)}/mo</span>
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Fixed-Period Interest Saved */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5">
            <span>Interest Saved (2026–2035)</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono-numbers text-purple-300 tracking-tight">
            {formatCurrency(simulation.fixedPeriodInterestSaved)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>107-Mo Ending Balance:</span>
            <span className="font-mono text-white font-semibold">
              {formatCurrency(simulation.endFixedBalance)}
            </span>
          </div>
        </div>

        {/* Card 4: 2035 ARM Reset Monthly Payment Shock */}
        <div className={`glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden transition-all ${
          isPostResetLowerThanToday ? 'border-emerald-500/30' : 'border-amber-500/30'
        }`}>
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5">
            <span>2035 Reset Payment Shock</span>
            <Calendar className={`w-4 h-4 ${isPostResetLowerThanToday ? 'text-emerald-400' : 'text-amber-400'}`} />
          </div>
          <div className={`text-2xl sm:text-3xl font-bold font-mono-numbers tracking-tight ${
            isPostResetLowerThanToday ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {formatCurrency(simulation.postResetMonthlyPI)}
            <span className="text-xs font-normal text-slate-400">/mo</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">@ {formatPercent(resetRate)} Rate:</span>
            {isPostResetLowerThanToday ? (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-semibold text-[11px] flex items-center gap-1">
                <Check className="w-3 h-3" /> Lower than today
              </span>
            ) : (
              <span className="text-amber-400 font-mono font-semibold">
                +{formatCurrency(simulation.postResetMonthlyPI - currentPI)}/mo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Control Panel */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4 gap-2">
          <div className="flex items-center space-x-2.5">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              Principal Curtailment & Automated Jumbo Recast Architecture
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Wells Fargo Home Mortgage • 10/6m SOFR ARM Servicing Model
          </span>
        </div>

        {/* 1. Top Card: Lump-Sum Curtailment Slider */}
        <div className="space-y-3 bg-white/[0.02] p-4.5 rounded-xl border border-white/5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <span>Lump-Sum Principal Curtailment</span>
              <span className="text-slate-500 font-normal">($0 to $350,000)</span>
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Principal Paid Down:</span>
              <span className="text-base font-bold font-mono-numbers text-blue-400">
                {formatCurrency(lumpSum)}
              </span>
            </div>
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

          {/* Quick Presets */}
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

        {/* 2. Sub-Card: Automatic Recast & Strategy Selector */}
        {isRecastEligible ? (
          <div className="space-y-4 bg-gradient-to-br from-blue-950/20 via-slate-900/60 to-purple-950/20 p-5 rounded-2xl border border-blue-500/20 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Wells Fargo $0-Fee Recast Automatically Applied</span>
                </span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Re-amortized over 347 remaining mos @ 5.750%
              </span>
            </div>

            {/* Segmented Control / Radio Toggle */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Mode A */}
              <button
                onClick={() => setStrategyMode('maintain_flat')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                  strategyMode === 'maintain_flat'
                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg ring-1 ring-blue-500/50'
                    : 'bg-slate-900/40 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span>Mode A: Maintain Flat Payment ($6,454.32/mo)</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">
                    Recommended
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-medium mb-1">
                  Maximize Equity & 2035 Reset Protection
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Borrower benefits from lower contractual P&I floor ({formatCurrency(simulation.recastRequiredMonthlyPI)}/mo), but channels the <span className="font-mono text-emerald-400 font-semibold">+{formatCurrency(recastDiff)}/mo</span> differential as automated incremental principal to aggressively crush debt before the 2035 reset.
                </p>
              </button>

              {/* Mode B */}
              <button
                onClick={() => setStrategyMode('take_reduced')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                  strategyMode === 'take_reduced'
                    ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-lg ring-1 ring-emerald-500/50'
                    : 'bg-slate-900/40 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Mode B: Take Reduced Recast Payment</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                    Cash Flow
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-medium mb-1">
                  Maximize Immediate Monthly Cash Flow
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Drop contractual out-of-pocket P&I to <span className="font-mono text-white font-semibold">{formatCurrency(simulation.recastRequiredMonthlyPI)}/mo</span>, immediately freeing up <span className="font-mono text-emerald-400 font-semibold">{formatCurrency(recastDiff)}/mo</span> ({formatCurrency(recastDiff * 12, 0)}/yr) in household cash flow.
                </p>
              </button>
            </div>

            {/* Dynamic Breakdown Subtext */}
            <div className="p-3 rounded-xl bg-slate-900/70 border border-white/10 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center space-x-2 text-slate-300">
                <Info className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  {strategyMode === 'maintain_flat' ? (
                    <>
                      Contractual P&I floor drops to <strong className="text-white font-mono">{formatCurrency(simulation.recastRequiredMonthlyPI)}/mo</strong>. Maintaining $6,454.32/mo automatically injects <strong className="text-emerald-400 font-mono">+{formatCurrency(recastDiff)}/mo</strong> in continuous principal paydown.
                    </>
                  ) : (
                    <>
                      Contractual out-of-pocket drops to <strong className="text-white font-mono">{formatCurrency(simulation.recastRequiredMonthlyPI)}/mo</strong>, freeing up <strong className="text-emerald-400 font-mono">{formatCurrency(recastDiff)}/mo</strong> ({formatCurrency(recastDiff * 12, 0)}/yr) for living expenses or alternative investments.
                    </>
                  )}
                </span>
              </div>
              <span className="text-slate-400 font-mono text-[11px] shrink-0">
                Floor: {formatCurrency(simulation.recastRequiredMonthlyPI)}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-400 flex items-center space-x-2">
            <Info className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              Wells Fargo requires a minimum <strong className="text-slate-300">$10,000</strong> principal reduction to qualify for an automated loan recast. Current required monthly P&I remains locked at <strong className="text-slate-300">{formatCurrency(BASELINE_LOAN.currentMonthlyPI)}</strong>.
            </span>
          </div>
        )}

        {/* 3. Recurring Monthly Extra Principal Slider */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-1">
          <div className="lg:col-span-2 space-y-3 bg-white/[0.02] p-4.5 rounded-xl border border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                {strategyMode === 'maintain_flat'
                  ? 'Additional Extra Monthly Principal (on top of flat $6,454.32)'
                  : 'Additional Extra Monthly Principal (on top of reduced recast P&I)'}
              </label>
              <span className="text-base font-bold font-mono-numbers text-emerald-400">
                +{formatCurrency(extraMonthly)}/mo
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

          {/* Smart Toggle: Stop at $750k */}
          <div className="space-y-3 bg-white/[0.02] p-4.5 rounded-xl border border-white/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Stop-at-$750k Cap Toggle
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
                Automatically halts extra monthly principal payments once the loan balance drops below the $750k Federal cap to preserve tax-deductible cash arbitrage.
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

        {/* 4. 2035 ARM Reset Rate Stress-Tester */}
        <div className="bg-white/[0.02] p-4.5 rounded-xl border border-white/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                September 1, 2035 ARM Reset Rate Stress-Tester (5/1/5 Caps)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Post-Reset Note Rate:</span>
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
              8.000% (Elevated Reset)
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
        {/* Chart 1: Dual-Series Amortization Trajectory Chart */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white">
                Amortization Trajectory (2026 – 2055)
              </h2>
              <p className="text-xs text-slate-400">
                Tracking statutory cap milestone retirements (NY $1.0M & Federal $750k) across 347 months.
              </p>
            </div>

            {/* Milestones Crossings Pill */}
            <div className="flex items-center space-x-2 text-[11px] font-mono">
              {simulation.crossingMonthNYCap !== null && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Tier 1 Cleared: Mo {simulation.crossingMonthNYCap}
                </span>
              )}
              {simulation.crossingMonthFedCap !== null && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Fed $750k Cap: Mo {simulation.crossingMonthFedCap}
                </span>
              )}
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

        {/* Chart 2: 2035 Reset Payment Shock Comparison (Baseline vs Mode A vs Mode B) */}
        <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">2035 Reset Payment Shock</h2>
              <span className="text-[11px] font-mono text-amber-400 font-semibold">
                @ {formatPercent(shockScenarioRate)} Rate
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Required monthly P&I starting October 1, 2035 (remaining 240 months).
            </p>

            {/* Quick Shock Rate Toggle */}
            <div className="flex gap-1 pt-2">
              {[0.07, 0.08, 0.1075].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setShockScenarioRate(rate)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer ${
                    shockScenarioRate === rate
                      ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {formatPercent(rate, 1)}
                </button>
              ))}
            </div>
          </div>

          <div className="h-48 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={paymentShockComparisonData}
                margin={{ top: 15, right: 5, left: 5, bottom: 5 }}
              >
                <XAxis
                  dataKey="name"
                  stroke="#64748B"
                  fontSize={9}
                  tickLine={false}
                  interval={0}
                  tickFormatter={(val) => val.split(' ')[0]}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={9}
                  tickLine={false}
                  domain={[0, Math.max(9000, baselinePostResetPI * 1.15)]}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(1)}k`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      const diffVsCurrent = d.amount - currentPI;
                      return (
                        <div className="bg-slate-900/95 border border-white/10 rounded-xl p-3 shadow-xl backdrop-blur-md text-xs space-y-1">
                          <div className="font-semibold text-white">{d.name}</div>
                          <div className="text-slate-400 text-[10px]">{d.category}</div>
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
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {paymentShockComparisonData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke={entry.isActive ? '#60A5FA' : undefined}
                      strokeWidth={entry.isActive ? 2 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-300">
              <span>Mode A 2035 Reset:</span>
              <span className={`font-mono font-bold ${modeAPostResetPI <= currentPI ? 'text-emerald-400' : 'text-amber-400'}`}>
                {formatCurrency(modeAPostResetPI)}/mo
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Mode B 2035 Reset:</span>
              <span className={`font-mono font-bold ${modeBPostResetPI <= currentPI ? 'text-emerald-400' : 'text-amber-400'}`}>
                {formatCurrency(modeBPostResetPI)}/mo
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-white/5 text-slate-400 text-[11px]">
              <span>Mode A Shock Cushion:</span>
              <span className="font-mono font-semibold text-emerald-400">
                {formatCurrency(baselinePostResetPI - modeAPostResetPI)}/mo saved
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
