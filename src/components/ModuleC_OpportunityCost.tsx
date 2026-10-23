import React, { useState, useMemo } from 'react';
import {
  Percent,
  Sliders,
  Award,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Info,
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
import type { TaxProfile, AssetBenchmark, TaxReturnInputs } from '../types/financial';
import { DEFAULT_TAX_RETURN_INPUTS } from '../constants/financialData';
import {
  formatCurrency,
  formatPercent,
  calculateAlternativeAssets,
  generateCompGrowthProfiles,
} from '../utils/financialCalculations';

interface ModuleCProps {
  taxProfile: TaxProfile;
  setTaxProfile: (profile: TaxProfile) => void;
  lumpSum: number;
  extraMonthly: number;
  taxReturnInputs?: TaxReturnInputs;
}

export const ModuleC_OpportunityCost: React.FC<ModuleCProps> = ({
  taxProfile,
  setTaxProfile,
  lumpSum,
  extraMonthly,
  taxReturnInputs,
}) => {
  const [showCustomSliders, setShowCustomSliders] = useState(false);
  const [showVolatilityBands, setShowVolatilityBands] = useState(true);

  const effectiveInputs = taxReturnInputs || DEFAULT_TAX_RETURN_INPUTS;

  // Generate the 3 compensation growth profiles:
  // 1. Profile A: Baseline (Tax Return Driven, 0% Comp Growth)
  // 2. Profile B: Moderate Comp Growth (+7.5%/yr)
  // 3. Profile C: Aggressive Comp Growth (+15.0%/yr)
  const growthProfiles = useMemo(() => {
    return generateCompGrowthProfiles(effectiveInputs, taxProfile);
  }, [effectiveInputs, taxProfile]);

  // Fallback defaults if zero curtailment selected, for realistic benchmark comparison
  const effectiveLump = lumpSum > 0 ? lumpSum : 90532.21;
  const effectiveMonthly = extraMonthly > 0 ? extraMonthly : 1000;

  // Calculate benchmarks for currently active profile
  const benchmarks: AssetBenchmark[] = useMemo(() => {
    return calculateAlternativeAssets({
      lumpSum: effectiveLump,
      monthlyCashFlow: effectiveMonthly,
      taxProfile,
    });
  }, [effectiveLump, effectiveMonthly, taxProfile]);

  // Calculate benchmarks across all 3 profiles for trajectory comparison matrix
  const matrixData = useMemo(() => {
    const list = [growthProfiles.profile_a, growthProfiles.profile_b, growthProfiles.profile_c];
    return list.map((prof) => {
      const bm = calculateAlternativeAssets({
        lumpSum: effectiveLump,
        monthlyCashFlow: effectiveMonthly,
        taxProfile: prof,
      });
      const hysa = bm.find((x) => x.id === 'hysa_cash');
      const nyMuni = bm.find((x) => x.id === 'ny_muni_bond');
      const mortgage = bm.find((x) => x.id === 'mortgage_paydown');
      const combinedMarginal = prof.federalRate + prof.nysRate + prof.nycRate + prof.niitRate;
      const hurdleRate = 0.0575 / (1 - combinedMarginal);
      const muniTaxableEquiv = nyMuni ? nyMuni.preTaxYield / (1 - (prof.federalRate + prof.nysRate + prof.nycRate)) : 0;

      return {
        profile: prof,
        combinedMarginal,
        hurdleRate,
        hysaAfterTax: hysa ? hysa.afterTaxYield : 0,
        muniTaxableEquiv,
        mortgageTerminal: mortgage ? mortgage.terminalValue107Mo : 0,
        hysaTerminal: hysa ? hysa.terminalValue107Mo : 0,
        nyMuniTerminal: nyMuni ? nyMuni.terminalValue107Mo : 0,
      };
    });
  }, [growthProfiles, effectiveLump, effectiveMonthly]);

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
      {/* Top Section: Compensation & Tax Profile Selector */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-5 border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4 gap-2">
          <div className="flex items-center space-x-2.5">
            <Percent className="w-5 h-5 text-purple-400" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Alternative Opportunity Cost & Compensation Trajectory Profiles
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Model how annual compensation growth shifts your statutory tax brackets and widens the hurdle rate to beat mortgage curtailment.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCustomSliders(!showCustomSliders)}
            className="flex items-center space-x-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showCustomSliders ? 'Hide Custom Sliders' : 'Fine-Tune Sliders'}</span>
          </button>
        </div>

        {/* 3 Redefined Compensation Growth Profiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {Object.values(growthProfiles).map((p) => {
            const isSelected = taxProfile.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setTaxProfile(p)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative group flex flex-col justify-between ${
                  isSelected
                    ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-950/50 ring-1 ring-purple-500/50'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/20 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span>{p.name}</span>
                    </span>
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold ${
                        p.id === 'profile_a'
                          ? 'bg-blue-500/20 text-blue-300'
                          : p.id === 'profile_b'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {p.compGrowthAnnualPct === 0
                        ? '0% Growth'
                        : `+${(p.compGrowthAnnualPct! * 100).toFixed(1)}%/yr`}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-baseline justify-between text-slate-300">
                      <span className="text-slate-400">Combined Marginal Drag:</span>
                      <strong className="font-mono text-white text-sm">
                        {formatPercent(p.federalRate + p.nysRate + p.nycRate + p.niitRate, 2)}
                      </strong>
                    </div>
                    {p.rateDeltaCombined !== undefined && p.rateDeltaCombined > 0 && (
                      <div className="flex items-baseline justify-between text-[11px] text-amber-400 font-mono">
                        <span>Tax Drag Increase vs Base:</span>
                        <strong>+{formatPercent(p.rateDeltaCombined, 2)}</strong>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between text-[11px] text-slate-400 font-mono pt-1">
                      <span>Projected 2035 AGI:</span>
                      <strong className="text-slate-200">
                        {formatCurrency(p.projectedYear9Agi || 550000, 0)}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-white/5 text-[11px] text-slate-400 leading-relaxed font-sans">
                  {p.bracketNote}
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

      {/* NEW: Side-by-Side Compensation Growth & Tax Rate Trajectory Matrix */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4 border border-white/10">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                Tax Rate Shift & Hurdle Rate Trajectory Matrix (Side-by-Side Impact)
              </h3>
              <p className="text-xs text-slate-400">
                Shows the mathematical impact of compensation growth on statutory tax brackets and alternative asset hurdle rates.
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            Active: <strong className="text-purple-300">{taxProfile.name.split(':')[0]}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Metric / Parameter</th>
                <th className="py-2.5 px-3 text-center bg-blue-500/5 text-blue-300 font-bold">
                  Profile A: Baseline (0% Growth)
                </th>
                <th className="py-2.5 px-3 text-center bg-amber-500/5 text-amber-300 font-bold">
                  Profile B: Moderate (+7.5%/yr)
                </th>
                <th className="py-2.5 px-3 text-center bg-rose-500/5 text-rose-300 font-bold">
                  Profile C: Aggressive (+15.0%/yr)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {/* Row 1: Comp Growth Rate */}
              <tr>
                <td className="py-2.5 px-3 font-sans text-slate-300 font-medium">Annual Comp Growth Rate</td>
                <td className="py-2.5 px-3 text-center text-slate-200">0.0% (Constant)</td>
                <td className="py-2.5 px-3 text-center text-amber-300 font-bold">+7.5% per year</td>
                <td className="py-2.5 px-3 text-center text-rose-300 font-bold">+15.0% per year</td>
              </tr>

              {/* Row 2: Projected Year 9 AGI */}
              <tr>
                <td className="py-2.5 px-3 font-sans text-slate-300 font-medium">Projected 2035 Reset AGI</td>
                <td className="py-2.5 px-3 text-center text-slate-200">
                  {formatCurrency(matrixData[0].profile.projectedYear9Agi || 550000, 0)}
                </td>
                <td className="py-2.5 px-3 text-center text-amber-300 font-bold">
                  {formatCurrency(matrixData[1].profile.projectedYear9Agi || 1048642, 0)}
                </td>
                <td className="py-2.5 px-3 text-center text-rose-300 font-bold">
                  {formatCurrency(matrixData[2].profile.projectedYear9Agi || 1929885, 0)}
                </td>
              </tr>

              {/* Row 3: Federal Marginal Bracket */}
              <tr>
                <td className="py-2.5 px-3 font-sans text-slate-300 font-medium">Federal Marginal Bracket</td>
                <td className="py-2.5 px-3 text-center text-slate-200">
                  {formatPercent(matrixData[0].profile.federalRate, 1)}
                </td>
                <td className="py-2.5 px-3 text-center text-amber-300 font-bold">
                  {formatPercent(matrixData[1].profile.federalRate, 1)}{' '}
                  <span className="text-[10px] text-amber-400 font-sans">(+2.0% top tier)</span>
                </td>
                <td className="py-2.5 px-3 text-center text-rose-300 font-bold">
                  {formatPercent(matrixData[2].profile.federalRate, 1)}{' '}
                  <span className="text-[10px] text-rose-400 font-sans">(37% in Yr 1)</span>
                </td>
              </tr>

              {/* Row 4: NY State Marginal Bracket */}
              <tr>
                <td className="py-2.5 px-3 font-sans text-slate-300 font-medium">NY State Marginal Bracket</td>
                <td className="py-2.5 px-3 text-center text-slate-200">
                  {formatPercent(matrixData[0].profile.nysRate, 2)}
                </td>
                <td className="py-2.5 px-3 text-center text-amber-300 font-bold">
                  {formatPercent(matrixData[1].profile.nysRate, 2)}{' '}
                  <span className="text-[10px] text-amber-400 font-sans">(+2.80% jump)</span>
                </td>
                <td className="py-2.5 px-3 text-center text-rose-300 font-bold">
                  {formatPercent(matrixData[2].profile.nysRate, 2)}{' '}
                  <span className="text-[10px] text-rose-400 font-sans">(+3.45% $1M+ surtax)</span>
                </td>
              </tr>

              {/* Row 5: NY §615 Itemized Clawback */}
              <tr>
                <td className="py-2.5 px-3 font-sans text-slate-300 font-medium">NY IT-196 Mortgage Clawback</td>
                <td className="py-2.5 px-3 text-center text-slate-300">
                  {formatPercent(matrixData[0].profile.nyClawbackPct, 0)} (Partial Shield)
                </td>
                <td className="py-2.5 px-3 text-center text-red-400 font-bold">
                  100% (Full Phaseout)
                </td>
                <td className="py-2.5 px-3 text-center text-red-400 font-bold">
                  100% (Full Phaseout)
                </td>
              </tr>

              {/* Row 6: Combined Marginal Tax Drag */}
              <tr className="bg-white/[0.02]">
                <td className="py-2.5 px-3 font-sans text-white font-bold">Combined Marginal Tax Drag</td>
                <td className="py-2.5 px-3 text-center font-bold text-blue-300 text-sm">
                  {formatPercent(matrixData[0].combinedMarginal, 2)}
                </td>
                <td className="py-2.5 px-3 text-center font-bold text-amber-300 text-sm">
                  {formatPercent(matrixData[1].combinedMarginal, 2)}{' '}
                  <span className="text-xs font-semibold text-amber-400 font-sans">(+4.80%)</span>
                </td>
                <td className="py-2.5 px-3 text-center font-bold text-rose-300 text-sm">
                  {formatPercent(matrixData[2].combinedMarginal, 2)}{' '}
                  <span className="text-xs font-semibold text-rose-400 font-sans">(+5.45%)</span>
                </td>
              </tr>

              {/* Row 7: 5.75% Mortgage Hurdle Rate */}
              <tr className="bg-blue-600/10">
                <td className="py-3 px-3 font-sans text-white font-bold">
                  Hurdle Rate Needed to Beat 5.75% Mortgage Paydown
                </td>
                <td className="py-3 px-3 text-center font-bold text-white text-sm">
                  {formatPercent(matrixData[0].hurdleRate, 2)}
                </td>
                <td className="py-3 px-3 text-center font-bold text-amber-300 text-sm">
                  {formatPercent(matrixData[1].hurdleRate, 2)}{' '}
                  <span className="text-xs font-semibold text-amber-400 font-sans">(+119 bps)</span>
                </td>
                <td className="py-3 px-3 text-center font-bold text-rose-300 text-sm">
                  {formatPercent(matrixData[2].hurdleRate, 2)}{' '}
                  <span className="text-xs font-semibold text-rose-400 font-sans">(+139 bps)</span>
                </td>
              </tr>

              {/* Row 8: 4.75% HYSA Cash After-Tax Yield */}
              <tr>
                <td className="py-2.5 px-3 font-sans text-slate-300 font-medium">4.75% HYSA Cash After-Tax Net Yield</td>
                <td className="py-2.5 px-3 text-center text-slate-200">
                  {formatPercent(matrixData[0].hysaAfterTax, 2)}
                </td>
                <td className="py-2.5 px-3 text-center text-amber-400">
                  {formatPercent(matrixData[1].hysaAfterTax, 2)}{' '}
                  <span className="text-[10px] text-slate-400 font-sans">(-23 bps erosion)</span>
                </td>
                <td className="py-2.5 px-3 text-center text-rose-400">
                  {formatPercent(matrixData[2].hysaAfterTax, 2)}{' '}
                  <span className="text-[10px] text-slate-400 font-sans">(-26 bps erosion)</span>
                </td>
              </tr>

              {/* Row 9: 4.10% NY Muni Bond Tax-Equivalent Yield */}
              <tr>
                <td className="py-2.5 px-3 font-sans text-slate-300 font-medium">4.10% NY Muni Tax-Equivalent Yield</td>
                <td className="py-2.5 px-3 text-center text-emerald-400 font-semibold">
                  {formatPercent(matrixData[0].muniTaxableEquiv, 2)}
                </td>
                <td className="py-2.5 px-3 text-center text-emerald-300 font-bold">
                  {formatPercent(matrixData[1].muniTaxableEquiv, 2)}{' '}
                  <span className="text-[10px] text-emerald-400 font-sans">(+74 bps)</span>
                </td>
                <td className="py-2.5 px-3 text-center text-emerald-300 font-bold">
                  {formatPercent(matrixData[2].muniTaxableEquiv, 2)}{' '}
                  <span className="text-[10px] text-emerald-400 font-sans">(+85 bps)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Strategic Takeaway Banner */}
        <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/20 text-xs text-purple-200/90 leading-relaxed flex items-start space-x-3">
          <Info className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-white block">
              Strategic Implication of Compensation Growth on Capital Allocation:
            </span>
            <p>
              As your income compounds (+7.5% to +15.0% annually), federal and NY state bracket jumps
              increase your combined marginal tax burden from <strong>49.53% to ~55.0%</strong>. This causes
              severe tax drag on ordinary income from HYSA cash and taxable bonds, raising the pre-tax hurdle rate required to beat mortgage paydown from <strong>11.39% to nearly 12.80%</strong>.
              Consequently, <strong>retiring unshielded 5.75% mortgage principal</strong> (a guaranteed, non-taxable return) and allocating to <strong>triple tax-free NY Municipal Bonds</strong> become mathematically superior wealth-preservation moves as compensation grows.
            </p>
          </div>
        </div>
      </div>

      {/* Asset Class Benchmark Table */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4 border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
              <span>Asset Class Benchmark Table (107-Month Horizon)</span>
              <span className="px-2 py-0.5 rounded text-[11px] bg-blue-500/10 text-blue-400 font-mono">
                Lump: {formatCurrency(effectiveLump)} + Monthly: {formatCurrency(effectiveMonthly)}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Reflecting active tax rates: <strong className="text-purple-300">{taxProfile.name}</strong> ({formatPercent(taxProfile.federalRate + taxProfile.nysRate + taxProfile.nycRate + taxProfile.niitRate, 2)} combined tax drag).
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
                      <span
                        className={
                          isMortgage
                            ? 'text-blue-400'
                            : b.afterTaxYield >= 0.0575
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }
                      >
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
      <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4 border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white">
              107-Month Horizon Terminal Wealth Accumulation (09/01/2035)
            </h2>
            <p className="text-xs text-slate-400">
              Comparing after-tax net wealth of {formatCurrency(effectiveLump)} initial capital + {formatCurrency(effectiveMonthly)}/mo under {taxProfile.name}.
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
