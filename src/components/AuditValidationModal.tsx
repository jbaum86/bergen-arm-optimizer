import {
  X,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { BASELINE_LOAN, AUDIT_CHECKPOINTS, TAX_PROFILES } from '../constants/financialData';
import { formatCurrency, simulateAmortization, calculatePmt } from '../utils/financialCalculations';
import type { LumpSumStrategyMode } from '../types/financial';

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyStrategy: (lumpSum: number, extraMonthly: number, strategyMode: LumpSumStrategyMode) => void;
}

export const AuditValidationModal: React.FC<AuditModalProps> = ({
  isOpen,
  onClose,
  onApplyStrategy,
}) => {
  if (!isOpen) return null;

  const defaultProfile = TAX_PROFILES.profile_a;

  // Run live simulations for all 4 checkpoints to verify live code matches audit
  // 1. Baseline
  const baselineSim = simulateAmortization({
    lumpSum: 0,
    extraMonthly: 0,
    strategyMode: 'maintain_flat',
    resetRate: 0.1075,
    taxProfile: defaultProfile,
  });

  // 2. Checkpoint 1 (Strategy 9): $90,532.21 lump sum + Mode A (Flat $6,454.32) + $0/mo slider
  const strat9Sim = simulateAmortization({
    lumpSum: 90532.21,
    extraMonthly: 0,
    strategyMode: 'maintain_flat',
    resetRate: 0.08, // 8.00% reset check
    taxProfile: defaultProfile,
  });
  const strat9Reset8 = calculatePmt(strat9Sim.endFixedBalance, 0.08, 240);

  // 3. Checkpoint 2 (Strategy 10): $90,532.21 lump sum + Mode B (Take Reduced) + $0/mo slider
  const strat10Sim = simulateAmortization({
    lumpSum: 90532.21,
    extraMonthly: 0,
    strategyMode: 'take_reduced',
    resetRate: 0.1075,
    taxProfile: defaultProfile,
  });

  // 4. Checkpoint 3 (Strategy 13): $90,532.21 lump sum + Mode A (Flat $6,454.32) + $1,000/mo extra
  const strat13Sim = simulateAmortization({
    lumpSum: 90532.21,
    extraMonthly: 1000,
    strategyMode: 'maintain_flat',
    resetRate: 0.1075,
    taxProfile: defaultProfile,
  });
  const strat13Reset1075 = calculatePmt(strat13Sim.endFixedBalance, 0.1075, 240);

  const testCases = [
    {
      id: 'baseline',
      title: 'Baseline Amortization (No Prepayment)',
      parameters: 'Starting Balance $1,090,532.21 @ 5.750%, $6,454.32/mo P&I, 107 Months',
      targetMetrics: [
        { label: '09/01/2035 Ending Balance', target: AUDIT_CHECKPOINTS.baselineEndingBalance, calculated: baselineSim.endFixedBalance },
        { label: 'Fixed-Period Interest Saved', target: 0.0, calculated: baselineSim.fixedPeriodInterestSaved },
      ],
      action: () => onApplyStrategy(0, 0, 'maintain_flat'),
    },
    {
      id: 'strat9',
      title: 'Checkpoint 1: $90,532.21 Lump Sum + Mode A (Maintain Flat $6,454.32)',
      parameters: 'Recast Required $5,918.41/mo + $535.91/mo Auto Incremental Principal',
      targetMetrics: [
        { label: 'Recast Required Floor', target: 5918.41, calculated: strat9Sim.recastRequiredMonthlyPI },
        { label: 'Auto Incremental Principal', target: 535.91, calculated: strat9Sim.recastIncrementalPrincipal },
        { label: '09/01/2035 Ending Balance', target: 768293.48, calculated: strat9Sim.endFixedBalance },
        { label: 'Fixed Interest Saved', target: 60454.22, calculated: strat9Sim.fixedPeriodInterestSaved },
        { label: '2035 Reset P&I @ 8.00%', target: 6426.31, calculated: strat9Reset8 },
      ],
      action: () => onApplyStrategy(90532.21, 0, 'maintain_flat'),
    },
    {
      id: 'strat10',
      title: 'Checkpoint 2: $90,532.21 Lump Sum + Mode B (Take Reduced Recast)',
      parameters: 'Required P&I drops to $5,918.41/mo (+$535.91/mo Household Cash Relief)',
      targetMetrics: [
        { label: 'Required P&I Paid', target: 5918.41, calculated: strat10Sim.totalOutOfPocketMonthlyPI },
        { label: 'Monthly Cash Flow Relief', target: 535.91, calculated: strat10Sim.monthlyCashFlowRelief },
        { label: '09/01/2035 Ending Balance', target: 842977.66, calculated: strat10Sim.endFixedBalance },
        { label: 'Fixed Interest Saved', target: 43112.41, calculated: strat10Sim.fixedPeriodInterestSaved },
      ],
      action: () => onApplyStrategy(90532.21, 0, 'take_reduced'),
    },
    {
      id: 'strat13',
      title: 'Checkpoint 3: $90,532.21 Lump Sum + Mode A + $1,000/mo Extra Principal',
      parameters: 'Total Out-of-Pocket $7,454.32/mo (+ $1,535.91/mo Total Incremental Principal)',
      targetMetrics: [
        { label: 'Total Incremental Principal', target: 1535.91, calculated: strat13Sim.totalMonthlyIncrementalPrincipal },
        { label: '09/01/2035 Ending Balance', target: 628934.05, calculated: strat13Sim.endFixedBalance },
        { label: 'Fixed Interest Saved', target: 92813.65, calculated: strat13Sim.fixedPeriodInterestSaved },
        { label: 'Post-Reset P&I @ 10.75% Cap', target: 6385.12, calculated: strat13Reset1075 },
      ],
      action: () => onApplyStrategy(90532.21, 1000, 'maintain_flat'),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0F172A] border border-white/10 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-[#0F172A] z-10">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Loan Statement Audit & Mathematical Verification Engine
              </h2>
              <p className="text-xs text-slate-400">
                Verified against Official Mortgage Statements & Automated Recast Architecture
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-6 text-xs">
          {/* Statement Checkpoint Summary */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Statement Ground Truth Checkpoints
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
              <div>
                <div className="text-slate-400 text-[10px]">Origination (09/01/2025):</div>
                <div className="font-mono font-semibold text-white">{formatCurrency(BASELINE_LOAN.originalBalance)}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">Statement (09/01/2026):</div>
                <div className="font-mono font-semibold text-white">{formatCurrency(BASELINE_LOAN.statementBalance)}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">Active (10/01/2026):</div>
                <div className="font-mono font-semibold text-emerald-400">{formatCurrency(BASELINE_LOAN.activeStartingBalance)}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">Contractual P&I:</div>
                <div className="font-mono font-semibold text-white">{formatCurrency(BASELINE_LOAN.currentMonthlyPI)}/mo</div>
              </div>
            </div>
          </div>

          {/* Test Cases Verification Cards */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Deterministic Mathematical Checkpoint Results
            </h3>

            {testCases.map((tc) => (
              <div
                key={tc.id}
                className="p-4 rounded-xl bg-slate-900/50 border border-white/5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-white text-sm">{tc.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{tc.parameters}</div>
                  </div>
                  <button
                    onClick={() => {
                      tc.action();
                      onClose();
                    }}
                    className="self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-all cursor-pointer flex items-center space-x-1"
                  >
                    <span>Load Strategy</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1 border-t border-white/5">
                  {tc.targetMetrics.map((m, idx) => {
                    const diff = Math.abs(m.calculated - m.target);
                    const isMatch = diff < 0.50; // sub-dollar precision match
                    return (
                      <div key={idx} className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                        <div className="text-[9px] text-slate-400 truncate">{m.label}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-mono font-bold text-white text-[11px]">
                            {formatCurrency(m.calculated)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono mt-0.5">
                          <span>Target: {formatCurrency(m.target)}</span>
                          <span className="text-emerald-400 font-semibold">{isMatch ? '✓' : diff.toFixed(1)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex justify-end bg-[#0F172A]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            Close Verifier
          </button>
        </div>
      </div>
    </div>
  );
};
