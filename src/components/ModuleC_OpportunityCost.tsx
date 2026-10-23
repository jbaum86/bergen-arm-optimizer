// src/components/ModuleC_OpportunityCost.tsx
import React, { useState } from 'react';
import {
  Percent,
  Sliders,
  Award,
  CheckCircle2,
} from 'lucide-react';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import type { TaxProfile, AssetBenchmark } from '../types/financial';
import { TAX_PROFILES } from '../constants/financialData';
import {
  formatCurrency,
  formatPercent,
  calculateAlternativeAssets,
} from '../utils/financialCalculations';

interface ModuleCProps {
  taxProfile: TaxProfile;
  setTaxProfile: (profile: TaxProfile) => void;
  lumpSum: number;
  extraMonthly: number;
}

export const ModuleC_OpportunityCost: React.FC<ModuleCProps> = ({
  taxProfile,
  setTaxProfile,
  lumpSum,
  extraMonthly,
}) => {
  const [showCustomSliders, setShowCustomSliders] = useState(false);
  const [showVolatilityBands, setShowVolatilityBands] = useState(true);

  // Fallback defaults if zero curtailment selected, for realistic benchmark comparison
  const effectiveLump = lumpSum > 0 ? lumpSum : 90532.21;
  const effectiveMonthly = extraMonthly > 0 ? extraMonthly : 1000;

  // Calculate benchmarks
  const benchmarks: AssetBenchmark[] = React.useMemo(() => {
    return calculateAlternativeAssets({
      lumpSum: effectiveLump,
      monthlyCashFlow: effectiveMonthly,
      taxProfile,
    });
  }, [effectiveLump, effectiveMonthly, taxProfile]);

  // Chart data
  const chartData = benchmarks.map((b) => ({
    name: b.name.replace(' (HYSA)', '').replace(' Index', ''),
    fullName: b.name,
    terminalValue: Math.round(b.terminalValue107Mo),
    afterTaxYield: b.afterTaxYield,
    category: b.category,
    color:
      b.id === 'mortgage_paydown'
        ? '#3B82F6' // Blue
        : b.id === 'sp500_index'
        ? '#8B5CF6' // Purple
        : b.id === 'ny_muni_bond' || b.id === 'tbill_1y' || b.id === 'tnote_10y'
        ? '#10B981' // Emerald
        : '#F59E0B', // Amber
  }));

  const handleCustomRateChange = (field: keyof TaxProfile, val: number) => {
    setTaxProfile({
      ...taxProfile,
      id: 'custom',
      name: 'Custom Tax Profile',
      description: 'Custom fine-tuned state and local rates',
      [field]: val,
    });
  };

  return (
    <div className="space-y-6">
      {/* Tax Profile Selector & Custom Controls */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4 gap-2">
          <div className="flex items-center space-x-2.5">
            <Percent className="w-5 h-5 text-purple-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              NYC Tax Profile & Statutory Hurdle Rate Matrix
            </h2>
          </div>
          <button
            onClick={() => setShowCustomSliders(!showCustomSliders)}
            className="flex items-center space-x-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showCustomSliders ? 'Hide Custom Sliders' : 'Fine-Tune Tax Sliders'}</span>
          </button>
        </div>

        {/* Profiles Grid */}
        <div className={`grid grid-cols-1 ${taxProfile.isReturnDriven ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3`}>
          {taxProfile.isReturnDriven && (
            <div className="p-4 rounded-xl border border-emerald-500/60 bg-emerald-500/10 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/50 text-left">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{taxProfile.name}</span>
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  Active Return
                </span>
              </div>
              <div className="text-[11px] text-emerald-200/90 leading-relaxed font-mono">
                {taxProfile.description}
              </div>
            </div>
          )}

          {Object.values(TAX_PROFILES).map((p) => {
            const isSelected = !taxProfile.isReturnDriven && taxProfile.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setTaxProfile(p)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600/20 border-purple-500 shadow-md ring-1 ring-purple-500/50'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/15 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white">{p.name}</span>
                  {p.id === 'profile_b' && (
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">
                      Audit Baseline
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 leading-relaxed font-mono">
                  {p.description}
                </div>
              </button>
            );
          })}
        </div>


        {/* Fine-Tuning Sliders (Collapsible) */}
        {showCustomSliders && (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Federal Marginal:</span>
                <span className="font-mono text-purple-300">{formatPercent(taxProfile.federalRate, 1)}</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.37}
                step={0.01}
                value={taxProfile.federalRate}
                onChange={(e) => handleCustomRateChange('federalRate', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">NYS Marginal:</span>
                <span className="font-mono text-purple-300">{formatPercent(taxProfile.nysRate, 2)}</span>
              </div>
              <input
                type="range"
                min={0.04}
                max={0.109}
                step={0.001}
                value={taxProfile.nysRate}
                onChange={(e) => handleCustomRateChange('nysRate', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">NYC Local Rate:</span>
                <span className="font-mono text-purple-300">{formatPercent(taxProfile.nycRate, 3)}</span>
              </div>
              <input
                type="range"
                min={0.03}
                max={0.03876}
                step={0.001}
                value={taxProfile.nycRate}
                onChange={(e) => handleCustomRateChange('nycRate', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">NY IT-196 Clawback:</span>
                <span className="font-mono text-purple-300">{formatPercent(taxProfile.nyClawbackPct, 0)}</span>
              </div>
              <input
                type="range"
                min={0.0}
                max={1.0}
                step={0.25}
                value={taxProfile.nyClawbackPct}
                onChange={(e) => handleCustomRateChange('nyClawbackPct', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Asset Class Benchmark Table */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
              <span>Asset Class Benchmark Table (107-Month Horizon)</span>
              <span className="px-2 py-0.5 rounded text-[11px] bg-blue-500/10 text-blue-400 font-mono">
                Lump: {formatCurrency(effectiveLump)} + Monthly: {formatCurrency(effectiveMonthly)}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Comparative after-tax yields and required pre-tax hurdle rates to beat paying down unshielded 5.75% mortgage debt.
            </p>
          </div>

          <button
            onClick={() => setShowVolatilityBands(!showVolatilityBands)}
            className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 cursor-pointer self-start sm:self-auto"
          >
            {showVolatilityBands ? 'Hide S&P 500 Range' : 'Show S&P 500 Range'}
          </button>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Asset Class / Instrument</th>
                <th className="py-3 px-3 text-right">Pre-Tax Yield</th>
                <th className="py-3 px-3 text-right">Tax Drag (NYC)</th>
                <th className="py-3 px-3 text-right">After-Tax Yield</th>
                <th className="py-3 px-3 text-right">Hurdle Rate</th>
                <th className="py-3 px-3 text-right font-semibold text-white">107-Mo Terminal Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {benchmarks.map((b) => {
                const isMortgage = b.id === 'mortgage_paydown';
                return (
                  <tr
                    key={b.id}
                    className={`transition-colors ${
                      isMortgage
                        ? 'bg-blue-600/10 font-medium text-white'
                        : 'hover:bg-white/[0.02] text-slate-300'
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-2">
                        {isMortgage ? (
                          <Award className="w-4 h-4 text-blue-400 shrink-0" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
                        )}
                        <div>
                          <div className={`font-semibold ${isMortgage ? 'text-blue-300' : 'text-slate-100'}`}>
                            {b.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans">{b.taxTreatmentNotes}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium">
                      {formatPercent(b.preTaxYield, 2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-400">
                      {b.effectiveTaxRate === 0 ? (
                        <span className="text-emerald-400 font-semibold">0.0% (Exempt)</span>
                      ) : (
                        <span className="text-red-400/90">{formatPercent(b.effectiveTaxRate, 1)}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      <span className={isMortgage ? 'text-blue-400' : b.afterTaxYield >= 0.0575 ? 'text-emerald-400' : 'text-amber-400'}>
                        {formatPercent(b.afterTaxYield, 2)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {isMortgage ? (
                        <span className="text-blue-400 font-semibold">5.750% (Base)</span>
                      ) : (
                        <span className="text-slate-300 font-medium">
                          {formatPercent(b.hurdleRateToBeatMortgage, 2)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white text-sm">
                      {formatCurrency(b.terminalValue107Mo, 0)}
                      {b.volatilityBand && showVolatilityBands && (
                        <div className="text-[10px] text-slate-400 font-mono font-normal">
                          [{formatCurrency(b.volatilityBand.lowTerminal, 0)} – {formatCurrency(b.volatilityBand.highTerminal, 0)}]
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Terminal Wealth Comparison Chart */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white">
              107-Month Horizon Terminal Wealth Accumulation (09/01/2035)
            </h2>
            <p className="text-xs text-slate-400">
              Comparing after-tax net wealth of {formatCurrency(effectiveLump)} initial capital + {formatCurrency(effectiveMonthly)}/mo across instruments.
            </p>
          </div>
          <span className="text-xs text-emerald-400 font-mono">
            Mortgage Paydown = Guaranteed {formatCurrency(benchmarks[0].terminalValue107Mo, 0)}
          </span>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <XAxis
                type="number"
                stroke="#64748B"
                fontSize={10}
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                domain={[0, 'dataMax + 40000']}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                width={120}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-900/95 border border-white/10 rounded-xl p-3 shadow-xl backdrop-blur-md text-xs space-y-1">
                        <div className="font-semibold text-white">{d.fullName}</div>
                        <div className="text-sm font-bold font-mono text-white">
                          Terminal Wealth: {formatCurrency(d.terminalValue, 0)}
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          Effective After-Tax Yield:{' '}
                          <span className="font-mono text-emerald-400 font-semibold">
                            {formatPercent(d.afterTaxYield, 2)}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="terminalValue" radius={[0, 6, 6, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
