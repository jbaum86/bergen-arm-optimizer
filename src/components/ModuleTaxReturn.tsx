// src/components/ModuleTaxReturn.tsx
import React, { useState } from 'react';
import {
  FileText,
  Calculator,
  ShieldCheck,
  RotateCcw,
  Save,
  Info,
  CheckCircle2,
  Percent,
  Sliders,
  Landmark,
  Layers,
} from 'lucide-react';
import type {
  TaxReturnInputs,
  TaxReturnAnalysis,
  FilingStatus,
  TaxProfile,
} from '../types/financial';
import { DEFAULT_TAX_RETURN_INPUTS } from '../constants/financialData';
import {
  calculateTaxReturnRates,
  formatCurrency,
  formatPercent,
} from '../utils/financialCalculations';

interface ModuleTaxReturnProps {
  taxReturnInputs: TaxReturnInputs;
  onSaveInputs: (inputs: TaxReturnInputs) => void;
  activeTaxProfile: TaxProfile;
  onResetToBaseline: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const ModuleTaxReturn: React.FC<ModuleTaxReturnProps> = ({
  taxReturnInputs,
  onSaveInputs,
  activeTaxProfile,
  onResetToBaseline,
  onNavigateToTab,
}) => {
  // Local form state
  const [inputs, setInputs] = useState<TaxReturnInputs>(taxReturnInputs);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Live computed analysis
  const analysis: TaxReturnAnalysis = React.useMemo(() => {
    return calculateTaxReturnRates(inputs);
  }, [inputs]);

  const handleInputChange = (field: keyof TaxReturnInputs, value: number | string | boolean) => {
    setInputs((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-compute Taxable Income if AGI or Deductions change and user hasn't explicitly entered a divergent amount
      if (field === 'federalAgi' || field === 'federalDeductions') {
        const agi = field === 'federalAgi' ? (value as number) : prev.federalAgi;
        const ded = field === 'federalDeductions' ? (value as number) : prev.federalDeductions;
        updated.federalTaxableIncome = Math.max(0, agi - ded);
      }
      if (field === 'nyAgi' || field === 'nyDeductions') {
        const agi = field === 'nyAgi' ? (value as number) : prev.nyAgi;
        const ded = field === 'nyDeductions' ? (value as number) : prev.nyDeductions;
        updated.nyTaxableIncome = Math.max(0, agi - ded);
      }
      return updated;
    });
  };

  const handleSave = () => {
    onSaveInputs(inputs);
    setSaveSuccessMessage('Tax return data stored and applied across all model modules!');
    setTimeout(() => {
      setSaveSuccessMessage(null);
    }, 4000);
  };

  const handleReset = () => {
    setInputs(DEFAULT_TAX_RETURN_INPUTS);
    onResetToBaseline();
    setSaveSuccessMessage('Reset to verified baseline tax profile.');
    setTimeout(() => {

      setSaveSuccessMessage(null);
    }, 4000);
  };

  const isAppliedReturnDriven = activeTaxProfile.isReturnDriven;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel rounded-2xl p-6 relative overflow-hidden border border-white/10">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-3 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Tax Return Intake & Tax Rate Calibration Engine
                </h2>
                {isAppliedReturnDriven ? (
                  <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Return-Driven Active</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-white/10">
                    Preset Tax Profile Active
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-1 max-w-3xl">
                Enter line items directly from Federal <strong>Form 1040</strong> and NY State/City{' '}
                <strong>Form IT-201 / IT-196</strong>. The engine computes both actual effective rates
                paid and statutory marginal tax brackets, then persists them to drive all debt stack
                tax shields, amortization schedules, and opportunity cost hurdle rates.
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center space-x-3 self-end lg:self-center">
            <button
              onClick={handleReset}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Baseline</span>
            </button>
            <button
              onClick={handleSave}
              className="flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save & Apply to Optimizer</span>
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {saveSuccessMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-medium">{saveSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* Application Mode Selector (Marginal vs. Effective) */}
      <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-white">
              Model Application Mode: Which Tax Rate Drives the Optimizer?
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Selected: <strong className="text-purple-300 uppercase">{inputs.rateModeToApply}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Option 1: Marginal Rates */}
          <button
            type="button"
            onClick={() => handleInputChange('rateModeToApply', 'marginal')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              inputs.rateModeToApply === 'marginal'
                ? 'bg-purple-600/20 border-purple-500 ring-1 ring-purple-500/50 shadow-md'
                : 'bg-white/[0.02] border-white/5 hover:border-white/10 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-white">Marginal Tax Rates (Recommended)</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-purple-500/20 text-purple-300">
                Statutory Standard
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Deductions (IRC §163 mortgage interest) and alternative investment yields occur on the{' '}
              <strong>incremental margin</strong>. This mode uses statutory top brackets:
              <strong className="text-slate-200">
                {' '}
                {formatPercent(analysis.marginalFederalRate, 1)} Fed / {formatPercent(analysis.marginalNysRate, 2)} NYS / {formatPercent(analysis.marginalNycRate, 3)} NYC (Combined: {formatPercent(analysis.marginalCombinedRate, 2)})
              </strong>.
            </p>
          </button>

          {/* Option 2: Effective Rates */}
          <button
            type="button"
            onClick={() => handleInputChange('rateModeToApply', 'effective')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              inputs.rateModeToApply === 'effective'
                ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500/50 shadow-md'
                : 'bg-white/[0.02] border-white/5 hover:border-white/10 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-white">Effective Tax Rates (Actual Paid)</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-blue-500/20 text-blue-300">
                Tax Paid / AGI
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Uses the actual average percentage of total taxes paid divided by Adjusted Gross
              Income:
              <strong className="text-slate-200">
                {' '}
                {formatPercent(analysis.effectiveFederalRate, 2)} Fed / {formatPercent(analysis.effectiveNysRate, 2)} NYS / {formatPercent(analysis.effectiveNycRate, 2)} NYC (Combined: {formatPercent(analysis.effectiveCombinedRate, 2)})
              </strong>.
            </p>
          </button>
        </div>
      </div>

      {/* 2-Column Tax Return Intake Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Federal Form 1040 Section */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Federal Return: IRS Form 1040</h3>
                <span className="text-xs text-slate-400">Filing Status & Statutory Income Lines</span>
              </div>
            </div>
            <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-blue-500/20 text-blue-300">
              Tax Year {inputs.taxYear}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Filing Status */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Filing Status
              </label>
              <select
                value={inputs.filingStatus}
                onChange={(e) => handleInputChange('filingStatus', e.target.value as FilingStatus)}
                className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="single">Single</option>
                <option value="married_joint">Married Filing Jointly</option>
                <option value="married_separate">Married Filing Separately</option>
                <option value="head_household">Head of Household</option>
              </select>
            </div>

            {/* Tax Year */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Tax Year</label>
              <select
                value={inputs.taxYear}
                onChange={(e) => handleInputChange('taxYear', Number(e.target.value))}
                className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value={2026}>2026 (Projected / ARM Year 2)</option>
                <option value={2025}>2025 (Most Recent Return)</option>
                <option value={2024}>2024 (Prior Year Benchmark)</option>
              </select>
            </div>
          </div>

          {/* Form 1040 Line 11: AGI */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                Form 1040, Line 11: Adjusted Gross Income (AGI)
              </label>
              <span className="text-[11px] text-slate-400 font-mono-numbers">
                {formatCurrency(inputs.federalAgi, 0)}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={inputs.federalAgi}
                onChange={(e) => handleInputChange('federalAgi', Number(e.target.value))}
                className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-white font-mono-numbers focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Form 1040 Line 12: Itemized Deductions */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                Form 1040, Line 12: Deductions (Schedule A Itemized / Standard)
              </label>
              <span className="text-[11px] text-slate-400 font-mono-numbers">
                {formatCurrency(inputs.federalDeductions, 0)}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">$</span>
              <input
                type="number"
                min="0"
                step="500"
                value={inputs.federalDeductions}
                onChange={(e) => handleInputChange('federalDeductions', Number(e.target.value))}
                className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-white font-mono-numbers focus:outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Includes mortgage interest (subject to $750k acquisition debt cap) + state/local tax SALT cap.
            </p>
          </div>

          {/* Form 1040 Line 15: Taxable Income */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                Form 1040, Line 15: Taxable Income
              </label>
              <span className="text-[11px] text-slate-400 font-mono-numbers">
                {formatCurrency(inputs.federalTaxableIncome, 0)}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={inputs.federalTaxableIncome}
                onChange={(e) => handleInputChange('federalTaxableIncome', Number(e.target.value))}
                className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-white font-mono-numbers focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Form 1040 Line 24: Total Tax */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                Form 1040, Line 24: Total Tax (Actual Federal Tax Liability)
              </label>
              <span className="text-[11px] text-slate-400 font-mono-numbers">
                {formatCurrency(inputs.federalTotalTax, 0)}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">$</span>
              <input
                type="number"
                min="0"
                step="500"
                value={inputs.federalTotalTax}
                onChange={(e) => handleInputChange('federalTotalTax', Number(e.target.value))}
                className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-white font-mono-numbers focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Net Investment Income Tax (NIIT) Checkbox */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-slate-200">
                Form 8960: Net Investment Income Tax (NIIT)
              </span>
              <p className="text-[11px] text-slate-400">
                3.8% surtax applies to investment returns if MAGI &gt; $200k (Single) / $250k (MFJ).
              </p>
            </div>
            <input
              type="checkbox"
              checked={inputs.hasNiit}
              onChange={(e) => handleInputChange('hasNiit', e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-white/20 cursor-pointer"
            />
          </div>
        </div>

        {/* NY State & City Form IT-201 Section */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">NY State & City: Form IT-201 & IT-196</h3>
                <span className="text-xs text-slate-400">New York State & Kings County Resident Returns</span>
              </div>
            </div>
            <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-emerald-500/20 text-emerald-300">
              NYC Resident
            </span>
          </div>

          {/* Form IT-201 Line 33: NY AGI */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                Form IT-201, Line 33: New York Adjusted Gross Income (NY AGI)
              </label>
              <span className="text-[11px] text-slate-400 font-mono-numbers">
                {formatCurrency(inputs.nyAgi, 0)}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={inputs.nyAgi}
                onChange={(e) => handleInputChange('nyAgi', Number(e.target.value))}
                className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-white font-mono-numbers focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Form IT-196: NY Itemized Deductions */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                Form IT-196: Total New York Itemized Deductions
              </label>
              <span className="text-[11px] text-slate-400 font-mono-numbers">
                {formatCurrency(inputs.nyDeductions, 0)}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">$</span>
              <input
                type="number"
                min="0"
                step="500"
                value={inputs.nyDeductions}
                onChange={(e) => handleInputChange('nyDeductions', Number(e.target.value))}
                className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-white font-mono-numbers focus:outline-none focus:border-emerald-500"
              />
            </div>
            <p className="text-[11px] text-emerald-400/90 mt-1">
              ★ Pre-TCJA $1,000,000 mortgage interest cap applies in NY (vs. $750,000 federal cap).
            </p>
          </div>

          {/* Form IT-201 Line 38: NY Taxable Income */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                Form IT-201, Line 38: New York Taxable Income
              </label>
              <span className="text-[11px] text-slate-400 font-mono-numbers">
                {formatCurrency(inputs.nyTaxableIncome, 0)}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={inputs.nyTaxableIncome}
                onChange={(e) => handleInputChange('nyTaxableIncome', Number(e.target.value))}
                className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-white font-mono-numbers focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Form IT-201 Line 46: NYS Tax */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                Form IT-201, Line 46: New York State Tax
              </label>
              <span className="text-[11px] text-slate-400 font-mono-numbers">
                {formatCurrency(inputs.nysTax, 0)}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">$</span>
              <input
                type="number"
                min="0"
                step="500"
                value={inputs.nysTax}
                onChange={(e) => handleInputChange('nysTax', Number(e.target.value))}
                className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-white font-mono-numbers focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Form IT-201 Line 50: NYC Resident Tax */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                Form IT-201, Line 50: New York City Resident Tax
              </label>
              <span className="text-[11px] text-slate-400 font-mono-numbers">
                {formatCurrency(inputs.nycTax, 0)}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">$</span>
              <input
                type="number"
                min="0"
                step="500"
                value={inputs.nycTax}
                onChange={(e) => handleInputChange('nycTax', Number(e.target.value))}
                className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-white font-mono-numbers focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* NY Tax Law §615 Clawback Diagnostic */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-200">
                NY Tax Law § 615 Itemized Deduction Limitation:
              </span>
              <div className="text-[11px] text-slate-400">
                {inputs.nyAgi > 1000000
                  ? 'NY AGI > $1M: 100% itemized deduction phaseout (charitable only)'
                  : inputs.nyAgi > 475000
                  ? 'NY AGI $475k – $1M: 50% statutory reduction on Form IT-196'
                  : inputs.nyAgi > 100000
                  ? 'NY AGI $100k – $475k: 25% statutory reduction on Form IT-196'
                  : 'NY AGI ≤ $100k: 0% reduction (full deductions allowed)'}
              </div>
            </div>
            <span className="px-2.5 py-1 rounded font-mono font-bold text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {formatPercent(analysis.nyClawbackPct, 0)} Clawback
            </span>
          </div>
        </div>
      </div>

      {/* Calculated Results & Rate Matrix Comparison */}
      <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-3 gap-2">
          <div className="flex items-center space-x-2.5">
            <Percent className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-white">
              Derived Tax Rate Matrix: Effective (Actual Paid) vs. Marginal (Next Dollar)
            </h3>
          </div>
          <div className="text-xs text-slate-400">
            Active Mode for Model Calculations:{' '}
            <strong className="text-white uppercase font-mono px-2 py-0.5 rounded bg-blue-600/30 border border-blue-500/40">
              {inputs.rateModeToApply}
            </strong>
          </div>
        </div>

        {/* 4 Scorecard Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Federal Rates */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
            <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
              <span>Federal Tax Rate</span>
              <span className="text-[10px] uppercase font-mono text-blue-400">Form 1040</span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs text-slate-400">Effective:</span>
              <span className="text-lg font-bold font-mono-numbers text-white">
                {formatPercent(analysis.effectiveFederalRate, 2)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Marginal:</span>
              <span className="text-lg font-bold font-mono-numbers text-blue-400">
                {formatPercent(analysis.marginalFederalRate, 1)}
              </span>
            </div>
            <div className="border-t border-white/5 pt-1.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>Applied to Model:</span>
              <strong className="text-emerald-400 font-mono">
                {formatPercent(
                  inputs.rateModeToApply === 'marginal'
                    ? analysis.marginalFederalRate
                    : analysis.effectiveFederalRate,
                  2
                )}
              </strong>
            </div>
          </div>

          {/* Card 2: NY State Rates */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
            <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
              <span>NY State Tax Rate</span>
              <span className="text-[10px] uppercase font-mono text-emerald-400">IT-201 Line 46</span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs text-slate-400">Effective:</span>
              <span className="text-lg font-bold font-mono-numbers text-white">
                {formatPercent(analysis.effectiveNysRate, 2)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Marginal:</span>
              <span className="text-lg font-bold font-mono-numbers text-emerald-400">
                {formatPercent(analysis.marginalNysRate, 2)}
              </span>
            </div>
            <div className="border-t border-white/5 pt-1.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>Applied to Model:</span>
              <strong className="text-emerald-400 font-mono">
                {formatPercent(
                  inputs.rateModeToApply === 'marginal'
                    ? analysis.marginalNysRate
                    : analysis.effectiveNysRate,
                  2
                )}
              </strong>
            </div>
          </div>

          {/* Card 3: NYC Resident Rates */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
            <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
              <span>NYC Resident Tax Rate</span>
              <span className="text-[10px] uppercase font-mono text-purple-400">IT-201 Line 50</span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs text-slate-400">Effective:</span>
              <span className="text-lg font-bold font-mono-numbers text-white">
                {formatPercent(analysis.effectiveNycRate, 2)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Marginal:</span>
              <span className="text-lg font-bold font-mono-numbers text-purple-400">
                {formatPercent(analysis.marginalNycRate, 3)}
              </span>
            </div>
            <div className="border-t border-white/5 pt-1.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>Applied to Model:</span>
              <strong className="text-emerald-400 font-mono">
                {formatPercent(
                  inputs.rateModeToApply === 'marginal'
                    ? analysis.marginalNycRate
                    : analysis.effectiveNycRate,
                  3
                )}
              </strong>
            </div>
          </div>

          {/* Card 4: Combined Tax Shield / Drag */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-900/30 to-purple-900/20 border border-blue-500/30 space-y-2">
            <div className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Combined Total Tax Rate</span>
              <span className="text-[10px] uppercase font-mono text-amber-300">All Jurisdictions</span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs text-slate-300">Total Effective:</span>
              <span className="text-lg font-bold font-mono-numbers text-white">
                {formatPercent(analysis.effectiveCombinedRate, 2)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-300">Total Marginal:</span>
              <span className="text-lg font-bold font-mono-numbers text-amber-300">
                {formatPercent(analysis.marginalCombinedRate, 2)}
              </span>
            </div>
            <div className="border-t border-white/10 pt-1.5 flex items-center justify-between text-[11px] text-slate-300">
              <span>Active Shield/Drag:</span>
              <strong className="text-emerald-400 font-mono text-sm">
                {formatPercent(
                  inputs.rateModeToApply === 'marginal'
                    ? analysis.marginalCombinedRate
                    : analysis.effectiveCombinedRate,
                  2
                )}
              </strong>
            </div>
          </div>
        </div>

        {/* Where This Percentage Is Used in the Model */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-xs text-slate-400">
          <div className="flex items-center space-x-2 text-slate-200 font-semibold">
            <Info className="w-4 h-4 text-blue-400" />
            <span>How These Percentages Propagate Through the Bergen Street Optimizer:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 space-y-1">
              <strong className="text-blue-400 block">Module A (Debt Stack Tax Shield):</strong>
              <span>
                Tier 3 (&le; $750k) deducts Federal (
                {formatPercent(analysis.appliedProfile.federalRate, 1)}) + NY State & City after{' '}
                {formatPercent(analysis.nyClawbackPct, 0)} clawback. Tier 2 ($750k–$1M) deducts NY only.
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 space-y-1">
              <strong className="text-purple-400 block">Module B (Amortization & Recast):</strong>
              <span>
                Calculates live marginal after-tax cost of interest paid, tracking the exact tax shield
                preserved or given up by curtailing principal.
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 space-y-1">
              <strong className="text-emerald-400 block">Module C (Alternative Opportunity Cost):</strong>
              <span>
                Discounts taxable benchmarks (HYSA, Treasuries, Corporate bonds) by Federal + NYS + NYC
                + NIIT to establish the hurdle rate needed to beat the mortgage paydown.
              </span>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-2 gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Data is securely persisted in your browser's local storage and auto-loaded on launch.</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Apply Rates to Model</span>
            </button>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('unified')}
                className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-all cursor-pointer"
              >
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Return to Command Center</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
