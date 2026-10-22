// src/components/ModuleA_TaxShield.tsx
import {
  TrendingDown,
  Calendar,
  AlertTriangle,
  Info,
  DollarSign,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import type { StrategySimulationResult, TaxProfile } from '../types/financial';
import { BASELINE_LOAN, AUDIT_CHECKPOINTS } from '../constants/financialData';
import { formatCurrency, formatPercent } from '../utils/financialCalculations';

interface ModuleAProps {
  simulation: StrategySimulationResult;
  taxProfile: TaxProfile;
  lumpSum: number;
  onSelectTier1Preset: () => void;
}

export const ModuleA_TaxShield: React.FC<ModuleAProps> = ({
  simulation,
  taxProfile,
  lumpSum,
  onSelectTier1Preset,
}) => {
  const currentActiveBalance = BASELINE_LOAN.activeStartingBalance - lumpSum;
  const { tier1, tier2, tier3 } = simulation.tierBreakdown;

  const totalBal = currentActiveBalance > 0 ? currentActiveBalance : 1;
  const pct1 = (tier1 / totalBal) * 100;
  const pct2 = (tier2 / totalBal) * 100;
  const pct3 = (tier3 / totalBal) * 100;

  // Marginal after-tax rate calculations for each tier based on active tax profile
  const tier1Rate = BASELINE_LOAN.currentInterestRate; // 5.750%
  const nyTaxShield = (taxProfile.nysRate + taxProfile.nycRate) * (1 - taxProfile.nyClawbackPct);
  const tier2Rate = BASELINE_LOAN.currentInterestRate * (1 - nyTaxShield);
  const tier3Rate = BASELINE_LOAN.currentInterestRate * (1 - (taxProfile.federalRate + nyTaxShield));

  const isTier1Cleared = tier1 <= 0.01;
  const isTier2Cleared = tier2 <= 0.01;

  return (
    <div className="space-y-6">
      {/* 4 Hero KPI Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Projected 2035 Reset Balance */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-blue-500/30 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5">
            <span>Projected 09/01/2035 Reset Balance</span>
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono-numbers text-white tracking-tight">
            {formatCurrency(simulation.endFixedBalance)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Baseline: <span className="font-mono text-slate-300">{formatCurrency(AUDIT_CHECKPOINTS.baselineEndingBalance)}</span>
            </span>
            {simulation.endFixedBalance < AUDIT_CHECKPOINTS.baselineEndingBalance && (
              <span className="text-emerald-400 font-medium font-mono">
                -{formatCurrency(AUDIT_CHECKPOINTS.baselineEndingBalance - simulation.endFixedBalance)}
              </span>
            )}
          </div>
        </div>

        {/* KPI 2: Fixed-Period Interest Saved */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5">
            <span>Cumulative Interest Saved (2026–35)</span>
            <TrendingDown className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono-numbers text-emerald-400 tracking-tight">
            {formatCurrency(simulation.fixedPeriodInterestSaved)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">Total Fixed Baseline Interest:</span>
            <span className="font-mono text-slate-300">{formatCurrency(524591.27)}</span>
          </div>
        </div>

        {/* KPI 3: Required Monthly P&I */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5">
            <span>Contractual Monthly P&I Floor</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono-numbers text-white tracking-tight">
            {formatCurrency(simulation.effectiveMonthlyPayment)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Current: <span className="font-mono text-slate-300">{formatCurrency(BASELINE_LOAN.currentMonthlyPI)}</span>
            </span>
            <span className="text-amber-400/90 font-mono">
              2035 Reset: {formatCurrency(simulation.postResetMonthlyPI)}
            </span>
          </div>
        </div>

        {/* KPI 4: Marginal After-Tax Return */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-purple-500/30 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5">
            <span>Next-Dollar Return on Principal</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono-numbers text-purple-300 tracking-tight">
            {formatPercent(simulation.marginalAfterTaxCost)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Active Tier:</span>
            <span className="font-semibold text-slate-200">
              {!isTier1Cleared ? 'Tier 1 (Zero Shield)' : !isTier2Cleared ? 'Tier 2 (NY Only)' : 'Tier 3 (Fed+NY)'}
            </span>
          </div>
        </div>
      </div>

      {/* Three-Tier Marginal Tax Shield Stack Bar */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-bold text-white">Three-Tier Mortgage Debt Stack Visualizer</h2>
              <span className="px-2 py-0.5 text-[11px] rounded bg-white/10 text-slate-300 font-mono">
                Balance: {formatCurrency(currentActiveBalance)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Visual segmentation of Samantha Martin's mortgage by statutory deductibility thresholds (IRC §163(h)(3) & NY Form IT-196).
            </p>
          </div>

          {!isTier1Cleared && (
            <button
              onClick={onSelectTier1Preset}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>Clear Tier 1 Curtailment ($90,532.21)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Visual Stacked Bar */}
        <div className="space-y-2">
          <div className="h-8 w-full rounded-xl overflow-hidden flex bg-slate-900/80 border border-white/10 p-1 gap-1">
            {/* Tier 3: $0 to $750k */}
            <div
              style={{ width: `${pct3}%` }}
              className="h-full rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 flex items-center justify-center text-[11px] font-mono font-bold text-emerald-950 transition-all duration-300 relative group overflow-hidden"
              title={`Tier 3 (Deductible Fed + NY): ${formatCurrency(tier3)}`}
            >
              <span className="truncate px-1.5 drop-shadow-sm">
                Tier 3 ({formatPercent(pct3 / 100, 1)})
              </span>
            </div>

            {/* Tier 2: $750k to $1M */}
            {tier2 > 0 && (
              <div
                style={{ width: `${pct2}%` }}
                className="h-full rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 flex items-center justify-center text-[11px] font-mono font-bold text-amber-950 transition-all duration-300 relative group overflow-hidden"
                title={`Tier 2 (NY IT-196 Deductible Only): ${formatCurrency(tier2)}`}
              >
                <span className="truncate px-1.5 drop-shadow-sm">
                  Tier 2 ({formatPercent(pct2 / 100, 1)})
                </span>
              </div>
            )}

            {/* Tier 1: Above $1M */}
            {tier1 > 0 && (
              <div
                style={{ width: `${pct1}%` }}
                className="h-full rounded-lg bg-gradient-to-r from-red-600 to-rose-500 flex items-center justify-center text-[11px] font-mono font-bold text-white transition-all duration-300 relative group overflow-hidden animate-pulse"
                title={`Tier 1 (Unshielded 5.75% Drag): ${formatCurrency(tier1)}`}
              >
                <span className="truncate px-1.5 drop-shadow-sm">
                  Tier 1 ({formatPercent(pct1 / 100, 1)})
                </span>
              </div>
            )}
          </div>

          {/* Threshold markers */}
          <div className="flex justify-between text-[11px] font-mono text-slate-400 px-1">
            <span>$0</span>
            <span className="text-emerald-400 font-semibold">$750,000 (Fed Cap)</span>
            <span className="text-amber-400 font-semibold">$1,000,000 (NY Cap)</span>
            <span className="text-slate-300 font-semibold">{formatCurrency(BASELINE_LOAN.activeStartingBalance)}</span>
          </div>
        </div>

        {/* 3 Detail Cards for the Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Tier 1 Card */}
          <div
            className={`rounded-xl p-4 border transition-all ${
              tier1 > 0
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-slate-900/40 border-slate-800 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Tier 1: Above $1,000,000
              </span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-red-500/20 text-red-300">
                {formatCurrency(tier1)}
              </span>
            </div>
            <div className="text-sm font-semibold text-white mb-1">
              Effective After-Tax Cost: <span className="font-mono text-red-400">{formatPercent(tier1Rate)}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong>0% Federal & 0% NY Deductible.</strong> Dollars in this tranche carry 100% of the 5.750% nominal interest drag with zero tax shield.
            </p>
            <div className="mt-3 text-[11px] text-red-300/80 bg-red-950/40 p-2 rounded-lg border border-red-900/30">
              💡 <em>Guaranteed Tax-Free Hurdle:</em> Paying down Tier 1 generates a pure, risk-free 5.75% after-tax return, equivalent to an ~11.0% pre-tax taxable yield in NYC.
            </div>
          </div>

          {/* Tier 2 Card */}
          <div
            className={`rounded-xl p-4 border transition-all ${
              tier2 > 0
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-slate-900/40 border-slate-800 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Tier 2: $750k to $1,000,000
              </span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                {formatCurrency(tier2)}
              </span>
            </div>
            <div className="text-sm font-semibold text-white mb-1">
              Effective After-Tax Cost: <span className="font-mono text-amber-400">{formatPercent(tier2Rate)}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong>0% Federal, Partial NY Deductible.</strong> Under NY Form IT-196 decoupled rule, up to $1M is eligible, but subject to NY Tax Law §615 clawback ({formatPercent(taxProfile.nyClawbackPct, 0)} reduction).
            </p>
            <div className="mt-3 text-[11px] text-amber-300/80 bg-amber-950/40 p-2 rounded-lg border border-amber-900/30">
              🏛️ <em>NY Decoupling Rule:</em> NY preserves the pre-TCJA $1M limit, providing a state/local tax shield of ~0.31% to 0.46% against 5.75%.
            </div>
          </div>

          {/* Tier 3 Card */}
          <div className="rounded-xl p-4 border bg-emerald-500/10 border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Tier 3: $0 to $750,000
              </span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                {formatCurrency(tier3)}
              </span>
            </div>
            <div className="text-sm font-semibold text-white mb-1">
              Effective After-Tax Cost: <span className="font-mono text-emerald-400">{formatPercent(tier3Rate)}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong>Fully Shielded (Federal + NY).</strong> Fully deductible on Schedule A acquisition indebtedness plus NY Form IT-196.
            </p>
            <div className="mt-3 text-[11px] text-emerald-300/80 bg-emerald-950/40 p-2 rounded-lg border border-emerald-900/30">
              🛡️ <em>Arbitrage Zone:</em> After-tax borrowing cost drops to ~3.43%–3.62%, making conservative cash/Treasuries attractive arbitrage vs paying down debt.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
