// src/components/ModuleD_CemaRefinance.tsx
import React, { useState } from 'react';
import {
  Landmark,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  BASELINE_LOAN,
  RELATIONSHIP_DISCOUNT_TIERS,
  REFINANCE_RATE_BENCHMARKS,
} from '../constants/financialData';
import type { RelationshipDiscountTier, RefinanceOption } from '../types/financial';
import {
  formatCurrency,
  formatPercent,
  calculateRefinanceAnalysis,
} from '../utils/financialCalculations';

export const ModuleD_CemaRefinance: React.FC = () => {
  const [targetRate, setTargetRate] = useState<number>(0.0500); // 5.00% future target
  const [termMonths, setTermMonths] = useState<number>(360);
  const [termLabel, setTermLabel] = useState<string>('30-Year Fixed');
  const [isCema, setIsCema] = useState<boolean>(true); // Default to CEMA on for NYC
  const [selectedTier, setSelectedTier] = useState<RelationshipDiscountTier>(
    RELATIONSHIP_DISCOUNT_TIERS[3] // $500k–$999k (-0.250%)
  );

  const terms = [
    { label: '30-Year Fixed', months: 360 },
    { label: '20-Year Fixed', months: 240 },
    { label: '15-Year Fixed', months: 180 },
    { label: '10/6m ARM', months: 360 },
  ];

  // Perform Refinance Analysis
  const refiAnalysis: RefinanceOption = React.useMemo(() => {
    return calculateRefinanceAnalysis({
      targetRate,
      termMonths,
      termLabel,
      isCema,
      relationshipTier: selectedTier,
      currentBalance: BASELINE_LOAN.activeStartingBalance,
    });
  }, [targetRate, termMonths, termLabel, isCema, selectedTier]);

  return (
    <div className="space-y-6">
      {/* Controls Card */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4 gap-2">
          <div className="flex items-center space-x-2.5">
            <Landmark className="w-5 h-5 text-blue-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              NYC CEMA Refinance & Wells Fargo Relationship Pricing
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Kings County Consolidation, Extension & Modification Agreement (CEMA)
          </span>
        </div>

        {/* Target Rate Slider & Benchmarks */}
        <div className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Target Refinance Base Interest Rate
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Base Rate:</span>
              <span className="text-base font-bold font-mono-numbers text-blue-400">
                {formatPercent(targetRate)}
              </span>
              {selectedTier.rateDiscount > 0 && (
                <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Net: {formatPercent(refiAnalysis.netRate)}
                </span>
              )}
            </div>
          </div>

          <input
            type="range"
            min={0.04}
            max={0.0775}
            step={0.00125}
            value={targetRate}
            onChange={(e) => setTargetRate(Number(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
          />

          {/* Rate Benchmark Chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {REFINANCE_RATE_BENCHMARKS.map((b) => {
              const isSelected = Math.abs(targetRate - b.rate) < 0.0001;
              return (
                <button
                  key={b.label}
                  onClick={() => setTargetRate(b.rate)}
                  className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
                  }`}
                >
                  {b.label}: {formatPercent(b.rate)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Term & CEMA Toggle Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Term Selector */}
          <div className="space-y-2 bg-white/[0.02] p-4 rounded-xl border border-white/5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Refinance Loan Product & Term
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {terms.map((t) => {
                const isSelected = termMonths === t.months && termLabel === t.label;
                return (
                  <button
                    key={t.label}
                    onClick={() => {
                      setTermMonths(t.months);
                      setTermLabel(t.label);
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-medium text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold shadow-sm'
                        : 'bg-slate-900/40 border border-white/5 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* NYC CEMA Toggle Switch */}
          <div className="space-y-2 bg-white/[0.02] p-4 rounded-xl border border-white/5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  New York CEMA Assignment Toggle
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Assign existing $1.09M mortgage to eliminate 1.925% NYC Mortgage Recording Tax.
                </p>
              </div>
              <button
                onClick={() => setIsCema(!isCema)}
                className={`w-14 h-7 rounded-full p-1 transition-colors cursor-pointer ${
                  isCema ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    isCema ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
              <span className="text-slate-400">Upfront CEMA Tax Savings:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {isCema ? `+$${(BASELINE_LOAN.activeStartingBalance * 0.01925 - 2500).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Saved` : '$0 (Full 1.925% MRT Charged)'}
              </span>
            </div>
          </div>
        </div>

        {/* Wells Fargo Relationship Pricing Tier Selector */}
        <div className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Wells Fargo Relationship Pricing Discount Matrix
            </label>
            <span className="text-xs text-amber-300 font-mono">
              Active Tier: {selectedTier.label} ({selectedTier.rateDiscount > 0 ? `-${formatPercent(selectedTier.rateDiscount)}` : selectedTier.closingCostCredit > 0 ? `$${selectedTier.closingCostCredit} Credit` : '0%'})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {RELATIONSHIP_DISCOUNT_TIERS.map((tier) => {
              const isSelected = selectedTier.label === tier.label;
              return (
                <button
                  key={tier.label}
                  onClick={() => setSelectedTier(tier)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500 shadow-sm text-white'
                      : 'bg-slate-900/30 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <div className="text-[11px] font-bold text-white leading-tight mb-1 truncate">
                    {tier.label.split(' ')[0]}
                  </div>
                  <div className="text-[10px] text-amber-300 font-mono font-semibold">
                    {tier.rateDiscount > 0
                      ? `-${formatPercent(tier.rateDiscount)} Rate`
                      : tier.closingCostCredit > 0
                      ? `$${tier.closingCostCredit} Fee Credit`
                      : 'Standard Rate'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Outputs & Financial Impact Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Output 1: New Monthly P&I */}
        <div className="glass-panel rounded-2xl p-5 space-y-2">
          <span className="text-xs text-slate-400 font-medium">New Monthly Required P&I</span>
          <div className="text-2xl font-bold font-mono text-white">
            {formatCurrency(refiAnalysis.newMonthlyPI)}
          </div>
          <div className="text-xs text-slate-400">
            Current: <span className="font-mono text-slate-300">{formatCurrency(BASELINE_LOAN.currentMonthlyPI)}</span>
          </div>
        </div>

        {/* Output 2: Monthly Cash Savings */}
        <div className="glass-panel rounded-2xl p-5 space-y-2">
          <span className="text-xs text-slate-400 font-medium">Monthly Cashflow Delta</span>
          <div
            className={`text-2xl font-bold font-mono ${
              refiAnalysis.monthlySavings >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {refiAnalysis.monthlySavings >= 0
              ? `+${formatCurrency(refiAnalysis.monthlySavings)}/mo`
              : `-${formatCurrency(Math.abs(refiAnalysis.monthlySavings))}/mo`}
          </div>
          <div className="text-xs text-slate-400">
            {refiAnalysis.monthlySavings >= 0 ? 'Positive cash flow relief' : 'Higher than existing 5.75%'}
          </div>
        </div>

        {/* Output 3: Total Net Closing Costs */}
        <div className="glass-panel rounded-2xl p-5 space-y-2">
          <span className="text-xs text-slate-400 font-medium">Total Net Upfront Closing Cost</span>
          <div className="text-2xl font-bold font-mono text-white">
            {formatCurrency(refiAnalysis.upfrontCosts.totalNetClosingCost)}
          </div>
          <div className="text-xs font-mono text-emerald-400">
            {isCema ? 'CEMA Enabled (No MRT)' : 'Includes 1.925% NYC Tax'}
          </div>
        </div>

        {/* Output 4: Break-Even Period & 8.9Y NPV */}
        <div className="glass-panel rounded-2xl p-5 space-y-2">
          <span className="text-xs text-slate-400 font-medium">Break-Even & 8.9Y NPV</span>
          <div className="text-2xl font-bold font-mono text-blue-400">
            {refiAnalysis.breakEvenMonths < 300
              ? `${refiAnalysis.breakEvenMonths.toFixed(1)} mos`
              : 'N/A (Costly)'}
          </div>
          <div className="text-xs font-mono text-slate-300">
            8.9Y NPV: <span className={refiAnalysis.npv8_9Years >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {formatCurrency(refiAnalysis.npv8_9Years, 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Upfront Closing Cost Breakdown Deep-Dive */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center space-x-2">
          <span>Upfront Closing Cost Breakdown: Standard Refinance vs NYC CEMA</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Standard NYC Refi Card */}
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 space-y-2.5">
            <div className="flex items-center justify-between text-red-400 font-bold uppercase tracking-wider">
              <span>Standard NYC Refinance</span>
              <span className="font-mono text-sm">{formatCurrency(29492.75)}</span>
            </div>
            <div className="space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span>NYC Mortgage Recording Tax (1.925% on $1.09M):</span>
                <span className="font-mono text-red-400 font-semibold">{formatCurrency(20992.75)}</span>
              </div>
              <div className="flex justify-between">
                <span>Title, Lender & Legal Fees:</span>
                <span className="font-mono text-slate-300">$8,500.00</span>
              </div>
              <div className="flex justify-between">
                <span>CEMA Legal & Assignment Fees:</span>
                <span className="font-mono text-slate-300">$0.00</span>
              </div>
            </div>
            <div className="pt-2 border-t border-red-500/20 text-[11px] text-red-300/80">
              ⚠️ In New York City, refinancing without CEMA triggers a penal 1.925% tax on the entire loan balance.
            </div>
          </div>

          {/* New York CEMA Assignment Card */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5">
            <div className="flex items-center justify-between text-emerald-400 font-bold uppercase tracking-wider">
              <span>New York CEMA Assignment</span>
              <span className="font-mono text-sm">{formatCurrency(11000.00)}</span>
            </div>
            <div className="space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span>NYC Mortgage Recording Tax (Existing Debt):</span>
                <span className="font-mono text-emerald-400 font-semibold">$0.00 (Exempt)</span>
              </div>
              <div className="flex justify-between">
                <span>Title, Lender & Legal Fees:</span>
                <span className="font-mono text-slate-300">$8,500.00</span>
              </div>
              <div className="flex justify-between">
                <span>Wells Fargo CEMA Legal/Assignment Fee:</span>
                <span className="font-mono text-slate-300">$2,500.00</span>
              </div>
            </div>
            <div className="pt-2 border-t border-emerald-500/20 text-[11px] text-emerald-300 flex items-center justify-between font-semibold">
              <span>Instant Upfront Cash Savings:</span>
              <span className="font-mono text-emerald-400 text-sm">+$18,492.75</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
