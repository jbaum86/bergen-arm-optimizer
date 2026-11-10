// src/utils/refiCalculations.ts
// Refinance break-even, net-benefit and trigger-rate math for the Rate Watch module.
import { BASELINE_LOAN } from '../constants/financialData';
import { calculatePmt } from './financialCalculations';

/** NYC + NYS mortgage recording tax for 1–2 family / condo loans ≥ $500k */
export const NYC_MORTGAGE_RECORDING_TAX_RATE = 0.01925;

/** Balance remaining after `months` level payments */
export function balanceAfter(principal: number, annualRate: number, payment: number, months: number): number {
  const r = annualRate / 12;
  let bal = principal;
  for (let m = 0; m < months && bal > 0; m++) {
    bal = bal + bal * r - payment;
  }
  return Math.max(0, bal);
}

/**
 * Live loan position as of `asOf`: amortizes the post-10/01/2026 baseline balance
 * forward for each scheduled payment made on the 1st of the month since then.
 */
export function currentLoanPosition(asOf: Date = new Date()) {
  const elapsed = (asOf.getFullYear() - 2026) * 12 + (asOf.getMonth() + 1 - 10);
  const paymentsMade = Math.min(Math.max(0, elapsed), BASELINE_LOAN.fixedMonthsRemaining);
  const balance = balanceAfter(
    BASELINE_LOAN.activeStartingBalance,
    BASELINE_LOAN.currentInterestRate,
    BASELINE_LOAN.currentMonthlyPI,
    paymentsMade
  );
  return {
    balance: Math.round(balance * 100) / 100,
    remainingMonths: BASELINE_LOAN.totalRemainingMonths - paymentsMade,
    fixedMonthsLeft: BASELINE_LOAN.fixedMonthsRemaining - paymentsMade,
    paymentsMade,
  };
}

export interface RefiInputs {
  balance: number;
  newRate: number; // decimal
  termMonths: number;
  closingCosts: number;
  horizonMonths: number;
  currentRate?: number;
  currentPayment?: number;
}

export interface RefiResult {
  newPayment: number;
  monthlySavings: number;
  annualSavings: number;
  breakevenMonths: number; // Infinity if never
  netBenefitAtHorizon: number;
  interestSavedAtHorizon: number;
}

export function analyzeRefi({
  balance,
  newRate,
  termMonths,
  closingCosts,
  horizonMonths,
  currentRate = BASELINE_LOAN.currentInterestRate,
  currentPayment = BASELINE_LOAN.currentMonthlyPI,
}: RefiInputs): RefiResult {
  const newPayment = calculatePmt(balance, newRate, termMonths);
  const monthlySavings = currentPayment - newPayment;
  const breakevenMonths = monthlySavings > 0 ? closingCosts / monthlySavings : Infinity;

  const oldBalH = balanceAfter(balance, currentRate, currentPayment, horizonMonths);
  const newBalH = balanceAfter(balance, newRate, newPayment, horizonMonths);

  // Wealth difference at horizon: cash-flow savings + equity difference − upfront costs
  const netBenefitAtHorizon = monthlySavings * horizonMonths + (oldBalH - newBalH) - closingCosts;

  const oldInterest = currentPayment * horizonMonths - (balance - oldBalH);
  const newInterest = newPayment * horizonMonths - (balance - newBalH);

  return {
    newPayment,
    monthlySavings,
    annualSavings: monthlySavings * 12,
    breakevenMonths,
    netBenefitAtHorizon,
    interestSavedAtHorizon: oldInterest - newInterest,
  };
}

/**
 * Highest all-in refinance rate that satisfies BOTH:
 *   • break-even within `breakevenTargetMonths`, and
 *   • positive net benefit by `horizonMonths`.
 * Returns a decimal rate (e.g. 0.0462). Both conditions are monotonic in rate,
 * so a bisection per condition is exact to ~0.1 bp.
 */
export function solveTriggerRate(
  base: Omit<RefiInputs, 'newRate'>,
  breakevenTargetMonths: number
): number {
  const current = base.currentRate ?? BASELINE_LOAN.currentInterestRate;
  const bisect = (ok: (rate: number) => boolean) => {
    let lo = 0.005;
    let hi = current;
    if (!ok(lo)) return 0;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (ok(mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  };

  const breakevenRate = bisect(
    (rate) => analyzeRefi({ ...base, newRate: rate }).breakevenMonths <= breakevenTargetMonths
  );
  const netBenefitRate = bisect((rate) => analyzeRefi({ ...base, newRate: rate }).netBenefitAtHorizon >= 0);

  return Math.min(breakevenRate, netBenefitRate);
}

