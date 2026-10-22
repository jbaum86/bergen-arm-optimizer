// src/utils/financialCalculations.ts
import { BASELINE_LOAN } from '../constants/financialData';
import type {
  RecastMode,
  TaxProfile,
  StrategySimulationResult,
  AmortizationMonth,
  AssetBenchmark,
  RefinanceOption,
  RelationshipDiscountTier,
} from '../types/financial';

/**
 * Standard fixed-rate monthly principal and interest payment formula
 */
export function calculatePmt(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate <= 0) return principal / months;
  const r = annualRate / 12;
  return principal * (r / (1 - Math.pow(1 + r, -months)));
}

/**
 * Format currency with options
 */
export function formatCurrency(amount: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Format percentages
 */
export function formatPercent(rate: number, decimals: number = 3): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

/**
 * Calculate marginal after-tax cost of mortgage interest
 */
export function calculateMarginalAfterTaxCost(balance: number, profile: TaxProfile): number {
  const grossRate = BASELINE_LOAN.currentInterestRate; // 5.750%

  if (balance > BASELINE_LOAN.statutoryCaps.nyDecoupledCap) {
    // Tier 1: > $1,000,000 -> 0% federal and 0% NY deductible
    return grossRate;
  } else if (balance > BASELINE_LOAN.statutoryCaps.federalAcquisitionCap) {
    // Tier 2: $750,000 to $1,000,000 -> 0% federal, NY Form IT-196 deductible with clawback
    const nyTaxShield = (profile.nysRate + profile.nycRate) * (1 - profile.nyClawbackPct);
    return grossRate * (1 - nyTaxShield);
  } else {
    // Tier 3: <= $750,000 -> Federal Schedule A + NY IT-196 deductible
    const nyTaxShield = (profile.nysRate + profile.nycRate) * (1 - profile.nyClawbackPct);
    const totalTaxShield = profile.federalRate + nyTaxShield;
    return grossRate * (1 - totalTaxShield);
  }
}

/**
 * Full Amortization Simulation for Baseline & Strategy
 */
export function simulateAmortization({
  lumpSum = 0,
  extraMonthly = 0,
  recastMode = 'no_recast' as RecastMode,
  stopAt750k = false,
  resetRate = BASELINE_LOAN.maxFirstResetRate, // 10.750%
  taxProfile,
}: {
  lumpSum?: number;
  extraMonthly?: number;
  recastMode?: RecastMode;
  stopAt750k?: boolean;
  resetRate?: number;
  taxProfile: TaxProfile;
}): StrategySimulationResult {
  const initialBalance = BASELINE_LOAN.activeStartingBalance - lumpSum;
  const fixedMonths = BASELINE_LOAN.fixedMonthsRemaining; // 107
  const variableMonths = BASELINE_LOAN.variableMonthsRemaining; // 240
  const grossFixedRate = BASELINE_LOAN.currentInterestRate; // 0.0575
  const baselineMonthlyPI = BASELINE_LOAN.currentMonthlyPI; // 6454.32

  // Determine contractual required payment during fixed period
  let contractualMonthlyPI = baselineMonthlyPI;
  if (recastMode === 'free_recast' || recastMode === 'hybrid_shadow') {
    if (lumpSum >= 10000) {
      contractualMonthlyPI = calculatePmt(initialBalance, grossFixedRate, BASELINE_LOAN.totalRemainingMonths);
    }
  }

  let balance = initialBalance;
  let fixedPeriodInterestPaid = 0;
  const fullSchedule: AmortizationMonth[] = [];

  const startDate = new Date(2026, 9, 1); // October 2026

  // 1. Fixed Period Simulation (Month 1 to 107)
  for (let m = 1; m <= fixedMonths; m++) {
    const curDate = new Date(startDate.getFullYear(), startDate.getMonth() + m, 1);
    const dateStr = curDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    if (balance <= 0) {
      fullSchedule.push({
        month: m,
        dateStr,
        balance: 0,
        interest: 0,
        principal: 0,
        extraPrincipal: 0,
        totalPayment: 0,
        isFixedPeriod: true,
        rate: grossFixedRate,
      });
      continue;
    }

    const monthlyRate = grossFixedRate / 12;
    const interest = balance * monthlyRate;

    let baseRequired = contractualMonthlyPI;
    let extra = extraMonthly;

    if (recastMode === 'hybrid_shadow') {
      // In hybrid mode, user pays contractual floor PLUS the difference up to baseline $6454.32
      const shadowBonus = Math.max(0, baselineMonthlyPI - contractualMonthlyPI);
      extra += shadowBonus;
    }

    if (stopAt750k && balance <= BASELINE_LOAN.statutoryCaps.federalAcquisitionCap) {
      extra = 0;
    }

    let totalPrincipal = baseRequired - interest + extra;
    let actualPayment = baseRequired + extra;

    if (totalPrincipal > balance) {
      totalPrincipal = balance;
      actualPayment = interest + totalPrincipal;
      extra = Math.max(0, totalPrincipal - (baseRequired - interest));
    }

    balance -= totalPrincipal;
    fixedPeriodInterestPaid += interest;

    fullSchedule.push({
      month: m,
      dateStr,
      balance: Math.max(0, balance),
      interest,
      principal: totalPrincipal - extra,
      extraPrincipal: extra,
      totalPayment: actualPayment,
      isFixedPeriod: true,
      rate: grossFixedRate,
    });
  }

  const endFixedBalance = Math.max(0, balance);

  // Calculate 2035 Reset Payment across remaining 240 variable months
  const postResetMonthlyPI = calculatePmt(endFixedBalance, resetRate, variableMonths);

  // 2. Variable Period Simulation (Month 108 to 347)
  let varBalance = endFixedBalance;
  for (let m = fixedMonths + 1; m <= BASELINE_LOAN.totalRemainingMonths; m++) {
    const curDate = new Date(startDate.getFullYear(), startDate.getMonth() + m, 1);
    const dateStr = curDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    if (varBalance <= 0) {
      fullSchedule.push({
        month: m,
        dateStr,
        balance: 0,
        interest: 0,
        principal: 0,
        extraPrincipal: 0,
        totalPayment: 0,
        isFixedPeriod: false,
        rate: resetRate,
      });
      continue;
    }

    const monthlyRate = resetRate / 12;
    const interest = varBalance * monthlyRate;
    let principal = postResetMonthlyPI - interest;

    if (principal > varBalance) {
      principal = varBalance;
    }

    varBalance -= principal;

    fullSchedule.push({
      month: m,
      dateStr,
      balance: Math.max(0, varBalance),
      interest,
      principal,
      extraPrincipal: 0,
      totalPayment: interest + principal,
      isFixedPeriod: false,
      rate: resetRate,
    });
  }

  // Exact fixed-period interest saved vs baseline
  // Baseline 107-month interest from $1,090,532.21 is $519,359.92
  const baselineInterest = 519359.92;
  const fixedPeriodInterestSaved = Math.max(0, baselineInterest - fixedPeriodInterestPaid);

  // Active debt stack tier breakdown
  const tier1 = Math.max(0, initialBalance - BASELINE_LOAN.statutoryCaps.nyDecoupledCap);
  const tier2 = Math.max(
    0,
    Math.min(initialBalance, BASELINE_LOAN.statutoryCaps.nyDecoupledCap) -
      BASELINE_LOAN.statutoryCaps.federalAcquisitionCap
  );
  const tier3 = Math.min(initialBalance, BASELINE_LOAN.statutoryCaps.federalAcquisitionCap);

  const marginalAfterTaxCost = calculateMarginalAfterTaxCost(initialBalance, taxProfile);

  return {
    endFixedBalance,
    fixedPeriodInterestPaid,
    fixedPeriodInterestSaved,
    effectiveMonthlyPayment: contractualMonthlyPI,
    cashFlowPayment:
      recastMode === 'hybrid_shadow'
        ? baselineMonthlyPI + (stopAt750k && initialBalance <= 750000 ? 0 : extraMonthly)
        : contractualMonthlyPI + (stopAt750k && initialBalance <= 750000 ? 0 : extraMonthly),
    postResetRate: resetRate,
    postResetMonthlyPI,
    fullSchedule,
    tierBreakdown: { tier1, tier2, tier3 },
    marginalAfterTaxCost,
  };
}

/**
 * Calculate 107-Month Terminal Value of Alternative Assets
 */
export function calculateAlternativeAssets({
  lumpSum,
  monthlyCashFlow,
  taxProfile,
}: {
  lumpSum: number;
  monthlyCashFlow: number;
  taxProfile: TaxProfile;
}): AssetBenchmark[] {
  const months = BASELINE_LOAN.fixedMonthsRemaining; // 107 months

  // Helper: Future Value with monthly compounding
  const calcFV = (pv: number, pmt: number, annualRate: number) => {
    if (annualRate === 0) return pv + pmt * months;
    const r = annualRate / 12;
    const fvPv = pv * Math.pow(1 + r, months);
    const fvPmt = pmt * ((Math.pow(1 + r, months) - 1) / r);
    return fvPv + fvPmt;
  };

  // Tax rates
  const fullOrdinaryTax = taxProfile.federalRate + taxProfile.niitRate + taxProfile.nysRate + taxProfile.nycRate;
  const fedNiitTax = taxProfile.federalRate + taxProfile.niitRate; // For Treasuries (State/City exempt)
  const ltcgCombinedTax = taxProfile.ltcgRate + taxProfile.niitRate + (taxProfile.nysRate + taxProfile.nycRate) * 0.8; // Blend for equities

  const benchmarks: AssetBenchmark[] = [
    {
      id: 'mortgage_paydown',
      name: 'Mortgage Principal Curtailment',
      category: 'Mortgage',
      preTaxYield: 0.0575,
      effectiveTaxRate: 0.0,
      afterTaxYield: 0.0575,
      hurdleRateToBeatMortgage: 0.0575,
      terminalValue107Mo: calcFV(lumpSum, monthlyCashFlow, 0.0575),
      taxTreatmentNotes: 'Guaranteed 5.75% tax-free yield on unshielded Tier-1 balance (> $1M). Zero volatility.',
    },
    {
      id: 'hysa',
      name: 'High-Yield Savings Account (HYSA)',
      category: 'Cash / Fixed Income',
      preTaxYield: 0.0435,
      effectiveTaxRate: fullOrdinaryTax,
      afterTaxYield: 0.0435 * (1 - fullOrdinaryTax),
      hurdleRateToBeatMortgage: 0.0575 / (1 - fullOrdinaryTax),
      terminalValue107Mo: calcFV(lumpSum, monthlyCashFlow, 0.0435 * (1 - fullOrdinaryTax)),
      taxTreatmentNotes: 'Fully taxed as ordinary income at Federal, NIIT, NY State, and NYC local rates.',
    },
    {
      id: 'cd_ladder',
      name: 'Top 1-Year CD Ladder',
      category: 'Cash / Fixed Income',
      preTaxYield: 0.0460,
      effectiveTaxRate: fullOrdinaryTax,
      afterTaxYield: 0.0460 * (1 - fullOrdinaryTax),
      hurdleRateToBeatMortgage: 0.0575 / (1 - fullOrdinaryTax),
      terminalValue107Mo: calcFV(lumpSum, monthlyCashFlow, 0.0460 * (1 - fullOrdinaryTax)),
      taxTreatmentNotes: 'FDIC insured, fully subject to 4-tier NYC tax drag (Fed + NIIT + NYS + NYC).',
    },
    {
      id: 'tbill_1y',
      name: '1-Year U.S. Treasury Bill',
      category: 'Cash / Fixed Income',
      preTaxYield: 0.0453,
      effectiveTaxRate: fedNiitTax,
      afterTaxYield: 0.0453 * (1 - fedNiitTax),
      hurdleRateToBeatMortgage: 0.0575 / (1 - fedNiitTax),
      terminalValue107Mo: calcFV(lumpSum, monthlyCashFlow, 0.0453 * (1 - fedNiitTax)),
      taxTreatmentNotes: 'Exempt from NYS and NYC income taxes! Taxed only at Federal + NIIT.',
    },
    {
      id: 'tnote_10y',
      name: '10-Year U.S. Treasury Note',
      category: 'Cash / Fixed Income',
      preTaxYield: 0.0512,
      effectiveTaxRate: fedNiitTax,
      afterTaxYield: 0.0512 * (1 - fedNiitTax),
      hurdleRateToBeatMortgage: 0.0575 / (1 - fedNiitTax),
      terminalValue107Mo: calcFV(lumpSum, monthlyCashFlow, 0.0512 * (1 - fedNiitTax)),
      taxTreatmentNotes: 'Duration matches remaining ARM fixed period. 100% NYS & NYC tax exempt.',
    },
    {
      id: 'ny_muni_bond',
      name: 'Triple-Tax-Exempt NY Municipal Bond',
      category: 'Cash / Fixed Income',
      preTaxYield: 0.0390,
      effectiveTaxRate: 0.0,
      afterTaxYield: 0.0390,
      hurdleRateToBeatMortgage: 0.0575, // Since 0% tax, hurdle is 5.75%
      terminalValue107Mo: calcFV(lumpSum, monthlyCashFlow, 0.0390),
      taxTreatmentNotes: '100% exempt from Federal, NY State, and NYC local taxes.',
    },
    {
      id: 'sp500_index',
      name: 'S&P 500 Taxable Equity Index',
      category: 'Equities',
      preTaxYield: 0.0850,
      effectiveTaxRate: ltcgCombinedTax,
      afterTaxYield: 0.0850 * (1 - ltcgCombinedTax * 0.4), // Assuming deferred realization & dividend tax
      hurdleRateToBeatMortgage: 0.0575 / (1 - ltcgCombinedTax * 0.4),
      terminalValue107Mo: calcFV(lumpSum, monthlyCashFlow, 0.0850 * (1 - ltcgCombinedTax * 0.4)),
      volatilityBand: {
        low: 0.0550,
        high: 0.1150,
        lowTerminal: calcFV(lumpSum, monthlyCashFlow, 0.0550 * (1 - ltcgCombinedTax * 0.4)),
        highTerminal: calcFV(lumpSum, monthlyCashFlow, 0.1150 * (1 - ltcgCombinedTax * 0.4)),
      },
      taxTreatmentNotes: 'Taxed at preferential LTCG + NIIT + NYS/NYC upon realization. Equity market risk applies.',
    },
  ];

  return benchmarks;
}

/**
 * Calculate NYC CEMA Refinance & Wells Fargo Relationship Pricing
 */
export function calculateRefinanceAnalysis({
  targetRate,
  termMonths,
  termLabel,
  isCema,
  relationshipTier,
  currentBalance = BASELINE_LOAN.activeStartingBalance,
}: {
  targetRate: number;
  termMonths: number;
  termLabel: string;
  isCema: boolean;
  relationshipTier: RelationshipDiscountTier;
  currentBalance?: number;
}): RefinanceOption {
  const netRate = Math.max(0.01, targetRate - relationshipTier.rateDiscount);
  const newMonthlyPI = calculatePmt(currentBalance, netRate, termMonths);
  const monthlySavings = BASELINE_LOAN.currentMonthlyPI - newMonthlyPI;

  // Closing costs
  // Standard NYC Mortgage Recording Tax (residential >= $500k): 1.925%
  const mortgageRecordingTax = isCema ? 0 : currentBalance * 0.01925;
  const standardClosingFees = 8500.0;
  const cemaAssignmentFees = isCema ? 2500.0 : 0.0;
  const relationshipCredit = relationshipTier.closingCostCredit;

  const totalNetClosingCost = Math.max(
    0,
    mortgageRecordingTax + standardClosingFees + cemaAssignmentFees - relationshipCredit
  );

  const standardTotalCost = currentBalance * 0.01925 + standardClosingFees;
  const cemaTotalCost = standardClosingFees + 2500.0;
  const cemaSavings = Math.max(0, standardTotalCost - cemaTotalCost);

  // Payback period
  const breakEvenMonths = monthlySavings > 0 ? totalNetClosingCost / monthlySavings : 999;

  // 8.9-Year (107 months) Net Present Value to 09/01/2035 reset
  const discountRateMonthly = BASELINE_LOAN.currentInterestRate / 12; // 5.75% / 12
  let pvSavings = 0;
  for (let m = 1; m <= BASELINE_LOAN.fixedMonthsRemaining; m++) {
    pvSavings += monthlySavings / Math.pow(1 + discountRateMonthly, m);
  }
  const npv8_9Years = pvSavings - totalNetClosingCost;

  return {
    targetRate,
    termMonths,
    termLabel,
    isCema,
    relationshipTier,
    netRate,
    newMonthlyPI,
    monthlySavings,
    upfrontCosts: {
      mortgageRecordingTax,
      standardClosingFees,
      cemaAssignmentFees,
      relationshipCredit,
      totalNetClosingCost,
      cemaSavings,
    },
    breakEvenMonths,
    npv8_9Years,
  };
}
