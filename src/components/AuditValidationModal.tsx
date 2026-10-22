import {
  X,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { BASELINE_LOAN, AUDIT_CHECKPOINTS, TAX_PROFILES } from '../constants/financialData';
import { formatCurrency, simulateAmortization, calculatePmt } from '../utils/financialCalculations';
import type { RecastMode } from '../types/financial';

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyStrategy: (lumpSum: number, extraMonthly: number, recastMode: RecastMode) => void;
}

export const AuditValidationModal: React.FC<AuditModalProps> = ({
  isOpen,
  onClose,
  onApplyStrategy,
}) => {
  if (!isOpen) return null;

  const defaultProfile = TAX_PROFILES.profile_b;

  // Run live simulations for all 4 checkpoints to verify live code matches audit
  // 1. Baseline
  const baselineSim = simulateAmortization({
    lumpSum: 0,
    extraMonthly: 0,
    recastMode: 'no_recast',
    resetRate: 0.1075,
    taxProfile: defaultProfile,
  });

  // 2. Strategy 9 ($90,532.21 lump sum, no recast)
  const strat9Sim = simulateAmortization({
    lumpSum: 90532.21,
    extraMonthly: 0,
    recastMode: 'no_recast',
    resetRate: 0.1075,
    taxProfile: defaultProfile,
  });

  // 3. Strategy 10 ($90,532.21 lump sum with free recast over 347 mos)
  const strat10Sim = simulateAmortization({
    lumpSum: 90532.21,
    extraMonthly: 0,
    recastMode: 'free_recast',
    resetRate: 0.1075,
    taxProfile: defaultProfile,
  });

  // 4. Strategy 13 ($90,532.21 lump sum + $1,000/mo extra, no recast)
  const strat13Sim = simulateAmortization({
    lumpSum: 90532.21,
    extraMonthly: 1000,
    recastMode: 'no_recast',
    resetRate: 0.1075,
    taxProfile: defaultProfile,
  });

  const strat13ResetPmt = calculatePmt(strat13Sim.endFixedBalance, 0.1075, 240);

  const testCases = [
    {
      id: 'baseline',
      title: 'Baseline Amortization (No Prepayment)',
      parameters: 'Starting Balance $1,090,532.21 @ 5.750%, $6,454.32/mo P&I, 107 Months',
      targetMetrics: [
        { label: '09/01/2035 Ending Balance', target: AUDIT_CHECKPOINTS.baselineEndingBalance, calculated: baselineSim.endFixedBalance },
        { label: 'Fixed-Period Interest Saved', target: 0.0, calculated: baselineSim.fixedPeriodInterestSaved },
      ],
      action: () => onApplyStrategy(0, 0, 'no_recast'),
    },
    {
      id: 'strat9',
      title: 'Strategy 9: Clear Tier 1 to $1.0M Cap (No Recast)',
      parameters: '$90,532.21 Lump-Sum Curtailment, No Recast (keep $6,454.32/mo)',
      targetMetrics: [
        { label: '09/01/2035 Ending Balance', target: AUDIT_CHECKPOINTS.strategy9EndingBalance, calculated: strat9Sim.endFixedBalance },
        { label: 'Fixed-Period Interest Saved', target: AUDIT_CHECKPOINTS.strategy9InterestSaved, calculated: strat9Sim.fixedPeriodInterestSaved },
      ],
      action: () => onApplyStrategy(90532.21, 0, 'no_recast'),
    },
    {
      id: 'strat10',
      title: 'Strategy 10: Clear Tier 1 + Free Jumbo Recast',
      parameters: '$90,532.21 Lump-Sum Curtailment with Free Recast across 347 months',
      targetMetrics: [
        { label: 'New Required Monthly P&I', target: AUDIT_CHECKPOINTS.strategy10RecastPmt, calculated: strat10Sim.effectiveMonthlyPayment },
        { label: 'Fixed-Period Interest Saved', target: AUDIT_CHECKPOINTS.strategy10InterestSaved, calculated: strat10Sim.fixedPeriodInterestSaved },
      ],
      action: () => onApplyStrategy(90532.21, 0, 'free_recast'),
    },
    {
      id: 'strat13',
      title: 'Strategy 13: Clear Tier 1 + $1,000/mo Extra Principal',
      parameters: '$90,532.21 Lump-Sum + $1,000/mo Extra Principal, No Recast',
      targetMetrics: [
        { label: '09/01/2035 Ending Balance', target: AUDIT_CHECKPOINTS.strategy13EndingBalance, calculated: strat13Sim.endFixedBalance },
        { label: 'Fixed-Period Interest Saved', target: AUDIT_CHECKPOINTS.strategy13InterestSaved, calculated: strat13Sim.fixedPeriodInterestSaved },
        { label: 'Post-Reset P&I @ 10.75% Cap', target: AUDIT_CHECKPOINTS.strategy13ResetPayment1075, calculated: strat13ResetPmt },
      ],
      action: () => onApplyStrategy(90532.21, 1000, 'no_recast'),
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
                Verified against Wells Fargo Loan #0813684933 Official Statements
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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1 border-t border-white/5">
                  {tc.targetMetrics.map((m, idx) => {
                    const diff = Math.abs(m.calculated - m.target);
                    const isMatch = diff < 0.50; // sub-dollar precision match
                    return (
                      <div key={idx} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                        <div className="text-[10px] text-slate-400">{m.label}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-mono font-bold text-white text-xs">
                            {formatCurrency(m.calculated)}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400 font-semibold flex items-center gap-0.5">
                            {isMatch ? '✓ Verified' : 'Diff: ' + diff.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                          Target: {formatCurrency(m.target)}
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
