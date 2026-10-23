// src/utils/financialCalculations.ts
import { BASELINE_LOAN } from '../constants/financialData';
import type {
  RecastMode,
  LumpSumStrategyMode,
  TaxProfile,
  StrategySimulationResult,
  AmortizationMonth,
  AssetBenchmark,
  TaxReturnInputs,
  TaxReturnAnalysis,
  FilingStatus,
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
 * Full Amortization Simulation for Baseline & Strategy with Automatic Recast Architecture
 */
export function simulateAmortization({
  lumpSum = 0,
  extraMonthly = 0,
  recastMode,
  strategyMode = 'maintain_flat',
  stopAt750k = false,
  resetRate = BASELINE_LOAN.maxFirstResetRate, // 10.750%
  taxProfile,
}: {
  lumpSum?: number;
  extraMonthly?: number;
  recastMode?: RecastMode;
  strategyMode?: LumpSumStrategyMode;
  stopAt750k?: boolean;
  resetRate?: number;
  taxProfile: TaxProfile;
}): StrategySimulationResult {
  const isRecastQualified = lumpSum >= 10000;
  const initialBalance = BASELINE_LOAN.activeStartingBalance - lumpSum;
  const fixedMonths = BASELINE_LOAN.fixedMonthsRemaining; // 107
  const variableMonths = BASELINE_LOAN.variableMonthsRemaining; // 240
  const grossFixedRate = BASELINE_LOAN.currentInterestRate; // 0.0575
  const baselineMonthlyPI = BASELINE_LOAN.currentMonthlyPI; // 6454.32

  // Determine effective strategy mode (honoring legacy recastMode if passed)
  let effectiveStrategyMode: LumpSumStrategyMode = strategyMode;
  if (recastMode === 'free_recast') {
    effectiveStrategyMode = 'take_reduced';
  } else if (recastMode === 'no_recast' || recastMode === 'hybrid_shadow') {
    effectiveStrategyMode = 'maintain_flat';
  }

  // Recast Required Monthly P&I (P_recast)
  const recastRequiredMonthlyPI = isRecastQualified
    ? calculatePmt(initialBalance, grossFixedRate, BASELINE_LOAN.totalRemainingMonths)
    : baselineMonthlyPI;

  // Incremental principal and out-of-pocket payment logic
  let recastIncrementalPrincipal = 0;
  let totalMonthlyIncrementalPrincipal = extraMonthly;
  let totalOutOfPocketMonthlyPI = baselineMonthlyPI + extraMonthly;
  let monthlyCashFlowRelief = 0;

  if (isRecastQualified) {
    if (effectiveStrategyMode === 'maintain_flat') {
      // Mode A: Maintain Flat Payment ($6,454.32)
      recastIncrementalPrincipal = Math.max(0, baselineMonthlyPI - recastRequiredMonthlyPI);
      totalMonthlyIncrementalPrincipal = recastIncrementalPrincipal + extraMonthly;
      totalOutOfPocketMonthlyPI = baselineMonthlyPI + extraMonthly;
      monthlyCashFlowRelief = 0;
    } else {
      // Mode B: Take Reduced Recast Payment
      recastIncrementalPrincipal = 0;
      totalMonthlyIncrementalPrincipal = extraMonthly;
      totalOutOfPocketMonthlyPI = recastRequiredMonthlyPI + extraMonthly;
      monthlyCashFlowRelief = Math.max(0, baselineMonthlyPI - recastRequiredMonthlyPI);
    }
  }

  const annualCashFlowRelief = monthlyCashFlowRelief * 12;

  let balance = initialBalance;
  let fixedPeriodInterestPaid = 0;
  const fullSchedule: AmortizationMonth[] = [];

  const startDate = new Date(2026, 9, 1); // October 2026
  let crossingMonthNYCap: number | null = initialBalance <= BASELINE_LOAN.statutoryCaps.nyDecoupledCap ? 0 : null;
  let crossingMonthFedCap: number | null = initialBalance <= BASELINE_LOAN.statutoryCaps.federalAcquisitionCap ? 0 : null;

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

    // Determine out-of-pocket base payment
    const basePmt = isRecastQualified && effectiveStrategyMode === 'take_reduced'
      ? recastRequiredMonthlyPI
      : baselineMonthlyPI;

    let activeExtra = extraMonthly;
    if (stopAt750k && balance <= BASELINE_LOAN.statutoryCaps.federalAcquisitionCap) {
      activeExtra = 0;
    }

    let actualPayment = basePmt + activeExtra;
    let totalPrincipal = actualPayment - interest;

    if (totalPrincipal > balance) {
      totalPrincipal = balance;
      actualPayment = interest + totalPrincipal;
    }

    balance -= totalPrincipal;
    fixedPeriodInterestPaid += interest;

    // Track cap crossings
    if (crossingMonthNYCap === null && balance <= BASELINE_LOAN.statutoryCaps.nyDecoupledCap) {
      crossingMonthNYCap = m;
    }
    if (crossingMonthFedCap === null && balance <= BASELINE_LOAN.statutoryCaps.federalAcquisitionCap) {
      crossingMonthFedCap = m;
    }

    fullSchedule.push({
      month: m,
      dateStr,
      balance: Math.max(0, balance),
      interest,
      principal: totalPrincipal - activeExtra,
      extraPrincipal: activeExtra + (isRecastQualified && effectiveStrategyMode === 'maintain_flat' ? recastIncrementalPrincipal : 0),
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

  // Cumulative incremental principal retired vs baseline ($171,252.30 retired in baseline)
  const totalPrincipalRetired = BASELINE_LOAN.activeStartingBalance - endFixedBalance;
  const cumulativeIncrementalPrincipalRetired = Math.max(0, totalPrincipalRetired - 171252.30);

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
    effectiveMonthlyPayment: recastRequiredMonthlyPI, // Contractual recast floor
    cashFlowPayment: totalOutOfPocketMonthlyPI,
    postResetRate: resetRate,
    postResetMonthlyPI,
    fullSchedule,
    tierBreakdown: { tier1, tier2, tier3 },
    marginalAfterTaxCost,
    // Enhanced Recast Telemetry
    isRecastQualified,
    strategyMode: effectiveStrategyMode,
    recastRequiredMonthlyPI,
    recastIncrementalPrincipal,
    totalMonthlyIncrementalPrincipal,
    totalOutOfPocketMonthlyPI,
    monthlyCashFlowRelief,
    annualCashFlowRelief,
    crossingMonthNYCap,
    crossingMonthFedCap,
    cumulativeIncrementalPrincipalRetired,
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
 * Determine statutory marginal tax rates from taxable income and filing status
 */
export function getStatutoryMarginalRates(
  fedTaxableIncome: number,
  nyTaxableIncome: number,
  filingStatus: FilingStatus
): { marginalFederal: number; marginalNys: number; marginalNyc: number } {
  const isJoint = filingStatus === 'married_joint';

  // Federal 2025/2026 Brackets
  let marginalFederal = 0.10;
  if (isJoint) {
    if (fedTaxableIncome > 731200) marginalFederal = 0.37;
    else if (fedTaxableIncome > 487450) marginalFederal = 0.35;
    else if (fedTaxableIncome > 383900) marginalFederal = 0.32;
    else if (fedTaxableIncome > 201050) marginalFederal = 0.24;
    else if (fedTaxableIncome > 94300) marginalFederal = 0.22;
    else if (fedTaxableIncome > 23200) marginalFederal = 0.12;
    else marginalFederal = 0.10;
  } else {
    if (fedTaxableIncome > 609350) marginalFederal = 0.37;
    else if (fedTaxableIncome > 243725) marginalFederal = 0.35;
    else if (fedTaxableIncome > 191950) marginalFederal = 0.32;
    else if (fedTaxableIncome > 100525) marginalFederal = 0.24;
    else if (fedTaxableIncome > 47150) marginalFederal = 0.22;
    else if (fedTaxableIncome > 11600) marginalFederal = 0.12;
    else marginalFederal = 0.10;
  }

  // NY State Brackets (Tax Law § 601)
  let marginalNys = 0.04;
  if (isJoint) {
    if (nyTaxableIncome > 25000000) marginalNys = 0.109;
    else if (nyTaxableIncome > 5000000) marginalNys = 0.103;
    else if (nyTaxableIncome > 2155350) marginalNys = 0.0965;
    else if (nyTaxableIncome > 323200) marginalNys = 0.0965;
    else if (nyTaxableIncome > 161550) marginalNys = 0.0685;
    else if (nyTaxableIncome > 43000) marginalNys = 0.060;
    else if (nyTaxableIncome > 27900) marginalNys = 0.055;
    else if (nyTaxableIncome > 23600) marginalNys = 0.0525;
    else if (nyTaxableIncome > 17150) marginalNys = 0.045;
    else marginalNys = 0.04;
  } else {
    if (nyTaxableIncome > 25000000) marginalNys = 0.109;
    else if (nyTaxableIncome > 5000000) marginalNys = 0.103;
    else if (nyTaxableIncome > 1077550) marginalNys = 0.0965;
    else if (nyTaxableIncome > 215400) marginalNys = 0.0685;
    else if (nyTaxableIncome > 80650) marginalNys = 0.060;
    else if (nyTaxableIncome > 21400) marginalNys = 0.055;
    else if (nyTaxableIncome > 13900) marginalNys = 0.0525;
    else if (nyTaxableIncome > 11700) marginalNys = 0.045;
    else marginalNys = 0.04;
  }

  // NYC Resident Tax Brackets (Admin Code § 11-1701)
  let marginalNyc = 0.03078;
  if (isJoint) {
    if (nyTaxableIncome > 90000) marginalNyc = 0.03876;
    else if (nyTaxableIncome > 45000) marginalNyc = 0.03819;
    else if (nyTaxableIncome > 21600) marginalNyc = 0.03762;
    else marginalNyc = 0.03078;
  } else {
    if (nyTaxableIncome > 50000) marginalNyc = 0.03876;
    else if (nyTaxableIncome > 25000) marginalNyc = 0.03819;
    else if (nyTaxableIncome > 12000) marginalNyc = 0.03762;
    else marginalNyc = 0.03078;
  }

  return { marginalFederal, marginalNys, marginalNyc };
}

/**
 * NY Tax Law § 615 itemized deduction limitation (clawback)
 */
export function calculateNyClawbackPct(nyAgi: number): number {
  if (nyAgi <= 100000) return 0.0;
  if (nyAgi <= 475000) return 0.25;
  if (nyAgi <= 1000000) return 0.50;
  return 1.0;
}

/**
 * Capture Federal & NY Tax Return inputs and compute effective and marginal rates
 */
export function calculateTaxReturnRates(inputs: TaxReturnInputs): TaxReturnAnalysis {
  // Effective Rates (Tax paid / AGI)
  const effectiveFederalRate =
    inputs.federalAgi > 0 ? Math.max(0, inputs.federalTotalTax / inputs.federalAgi) : 0;
  const effectiveNysRate =
    inputs.nyAgi > 0 ? Math.max(0, inputs.nysTax / inputs.nyAgi) : 0;
  const effectiveNycRate =
    inputs.nyAgi > 0 ? Math.max(0, inputs.nycTax / inputs.nyAgi) : 0;
  const effectiveCombinedRate = effectiveFederalRate + effectiveNysRate + effectiveNycRate;

  // Marginal statutory brackets
  const { marginalFederal, marginalNys, marginalNyc } = getStatutoryMarginalRates(
    inputs.federalTaxableIncome,
    inputs.nyTaxableIncome,
    inputs.filingStatus
  );

  const niitRate = inputs.hasNiit ? 0.038 : 0;
  const marginalCombinedRate = marginalFederal + marginalNys + marginalNyc + niitRate;

  // NY Tax Law § 615 itemized deduction clawback
  const nyClawbackPct = calculateNyClawbackPct(inputs.nyAgi);

  // Selected rates to apply
  const isMarginal = inputs.rateModeToApply === 'marginal';
  const appliedFedRate = isMarginal ? marginalFederal : effectiveFederalRate;
  const appliedNysRate = isMarginal ? marginalNys : effectiveNysRate;
  const appliedNycRate = isMarginal ? marginalNyc : effectiveNycRate;

  const appliedProfile: TaxProfile = {
    id: 'custom',
    name: `Tax Return (${isMarginal ? 'Marginal' : 'Effective'})`,
    description: `Form 1040/IT-201: ${(appliedFedRate * 100).toFixed(2)}% Fed / ${(appliedNysRate * 100).toFixed(2)}% NYS / ${(appliedNycRate * 100).toFixed(2)}% NYC`,
    federalRate: appliedFedRate,
    nysRate: appliedNysRate,
    nycRate: appliedNycRate,
    niitRate,
    ltcgRate: appliedFedRate >= 0.35 ? 0.20 : 0.15,
    nyClawbackPct,
    isReturnDriven: true,
    effectiveFederalRate,
    effectiveNysRate,
    effectiveNycRate,
  };

  return {
    effectiveFederalRate,
    marginalFederalRate: marginalFederal,
    effectiveNysRate,
    marginalNysRate: marginalNys,
    effectiveNycRate,
    marginalNycRate: marginalNyc,
    effectiveCombinedRate,
    marginalCombinedRate,
    nyClawbackPct,
    appliedProfile,
  };
}

/**
 * Generate Compensation Growth Trajectory Profiles (Profile A Baseline, Profile B +7.5%/yr, Profile C +15%/yr)
 */
export function generateCompGrowthProfiles(
  baseInputs: TaxReturnInputs,
  activeReturnProfile: TaxProfile
): Record<string, TaxProfile> {
  const baseAgi = baseInputs.federalAgi > 0 ? baseInputs.federalAgi : 550000;
  const filingStatus = baseInputs.filingStatus;
  const isJoint = filingStatus === 'married_joint';

  // Profile A: Baseline using tax rates from the new tax rate section
  const profileA: TaxProfile = {
    ...activeReturnProfile,
    id: 'profile_a',
    name: 'Profile A: Baseline (Tax Return)',
    description: `Current Return: ${(activeReturnProfile.federalRate * 100).toFixed(1)}% Fed / ${(activeReturnProfile.nysRate * 100).toFixed(2)}% NYS / ${(activeReturnProfile.nycRate * 100).toFixed(3)}% NYC (0% Comp Growth Baseline)`,
    compGrowthAnnualPct: 0.0,
    projectedYear9Agi: Math.round(baseAgi),
    rateDeltaCombined: 0.0,
    bracketNote: `Baseline tax rates directly calibrated from Form 1040 & IT-201 at constant earnings (${formatCurrency(baseAgi, 0)} AGI).`,
  };

  const baseCombined =
    profileA.federalRate + profileA.nysRate + profileA.nycRate + profileA.niitRate;

  // Profile B: Moderate Comp Growth (7.5% per year over 107 months / 8.917 years)
  const projAgiB = baseAgi * Math.pow(1 + 0.075, 107 / 12);
  const deductionRatio = baseAgi > 0 ? Math.min(0.3, baseInputs.federalDeductions / baseAgi) : 0.12;
  const projFedTaxableB = Math.max(0, projAgiB * (1 - deductionRatio));
  const projNyTaxableB = Math.max(0, projAgiB * (1 - deductionRatio));
  const ratesB = getStatutoryMarginalRates(projFedTaxableB, projNyTaxableB, filingStatus);
  const clawbackB = calculateNyClawbackPct(projAgiB);
  const niitB = projAgiB > (isJoint ? 250000 : 200000) ? 0.038 : 0.0;
  const ltcgB = projFedTaxableB > (isJoint ? 583750 : 518900) ? 0.20 : 0.15;
  const combinedB = ratesB.marginalFederal + ratesB.marginalNys + ratesB.marginalNyc + niitB;

  const profileB: TaxProfile = {
    id: 'profile_b',
    name: 'Profile B: Moderate Comp Growth (+7.5%/yr)',
    description: `${(ratesB.marginalFederal * 100).toFixed(1)}% Fed / ${(ratesB.marginalNys * 100).toFixed(2)}% NYS / ${(ratesB.marginalNyc * 100).toFixed(3)}% NYC (${(clawbackB * 100).toFixed(0)}% NY Clawback, ${formatCurrency(projAgiB, 0)} Projected AGI)`,
    federalRate: ratesB.marginalFederal,
    nysRate: ratesB.marginalNys,
    nycRate: ratesB.marginalNyc,
    niitRate: niitB,
    ltcgRate: ltcgB,
    nyClawbackPct: clawbackB,
    compGrowthAnnualPct: 0.075,
    projectedYear9Agi: Math.round(projAgiB),
    rateDeltaCombined: combinedB - baseCombined,
    bracketNote: `Compounding at 7.5%/yr reaches ${formatCurrency(projAgiB, 0)} by 2035 reset: jumps into Federal ${(ratesB.marginalFederal * 100).toFixed(1)}% and NYS ${(ratesB.marginalNys * 100).toFixed(2)}% brackets (${(clawbackB * 100).toFixed(0)}% NY deduction clawback).`,
  };

  // Profile C: Aggressive Comp Growth (15.0% per year over 107 months / 8.917 years)
  const projAgiC = baseAgi * Math.pow(1 + 0.15, 107 / 12);
  const projFedTaxableC = Math.max(0, projAgiC * (1 - deductionRatio));
  const projNyTaxableC = Math.max(0, projAgiC * (1 - deductionRatio));
  const ratesC = getStatutoryMarginalRates(projFedTaxableC, projNyTaxableC, filingStatus);
  const clawbackC = calculateNyClawbackPct(projAgiC);
  const niitC = projAgiC > (isJoint ? 250000 : 200000) ? 0.038 : 0.0;
  const ltcgC = 0.20;
  const combinedC = ratesC.marginalFederal + ratesC.marginalNys + ratesC.marginalNyc + niitC;

  const profileC: TaxProfile = {
    id: 'profile_c',
    name: 'Profile C: Aggressive Comp Growth (+15.0%/yr)',
    description: `${(ratesC.marginalFederal * 100).toFixed(1)}% Fed / ${(ratesC.marginalNys * 100).toFixed(2)}% NYS / ${(ratesC.marginalNyc * 100).toFixed(3)}% NYC (${(clawbackC * 100).toFixed(0)}% NY Clawback, ${formatCurrency(projAgiC, 0)} Projected AGI)`,
    federalRate: ratesC.marginalFederal,
    nysRate: ratesC.marginalNys,
    nycRate: ratesC.marginalNyc,
    niitRate: niitC,
    ltcgRate: ltcgC,
    nyClawbackPct: clawbackC,
    compGrowthAnnualPct: 0.15,
    projectedYear9Agi: Math.round(projAgiC),
    rateDeltaCombined: combinedC - baseCombined,
    bracketNote: `Compounding at 15.0%/yr reaches ${formatCurrency(projAgiC, 0)} by 2035 reset: triggers top ${(ratesC.marginalFederal * 100).toFixed(1)}% Federal, ${(ratesC.marginalNys * 100).toFixed(2)}% NYS, 20% LTCG, and 100% deduction clawback.`,
  };

  return {
    profile_a: profileA,
    profile_b: profileB,
    profile_c: profileC,
  };
}


