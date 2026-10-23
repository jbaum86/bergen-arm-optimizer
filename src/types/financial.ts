// src/types/financial.ts

export type RecastMode = 'no_recast' | 'free_recast' | 'hybrid_shadow';
export type LumpSumStrategyMode = 'maintain_flat' | 'take_reduced';
export type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_household';

export interface TaxProfile {
  id: 'profile_a' | 'profile_b' | 'profile_c' | 'custom';
  name: string;
  description: string;
  federalRate: number;      // e.g. 0.35
  nysRate: number;          // e.g. 0.0685
  nycRate: number;          // e.g. 0.03876
  niitRate: number;         // e.g. 0.038
  ltcgRate: number;         // e.g. 0.15
  nyClawbackPct: number;    // e.g. 0.50 (50% reduction of NY IT-196)
  isReturnDriven?: boolean;
  effectiveFederalRate?: number;
  effectiveNysRate?: number;
  effectiveNycRate?: number;
  compGrowthAnnualPct?: number; // e.g. 0, 0.075, 0.15
  projectedYear9Agi?: number;   // Projected AGI in month 107
  rateDeltaCombined?: number;   // Combined marginal tax rate change vs Baseline
  bracketNote?: string;
}


export interface TaxReturnInputs {
  taxYear: number;
  filingStatus: FilingStatus;
  // Federal 1040 lines
  federalAgi: number;          // Form 1040 Line 11
  federalDeductions: number;   // Form 1040 Line 12
  federalTaxableIncome: number;// Form 1040 Line 15
  federalTotalTax: number;     // Form 1040 Line 24
  hasNiit: boolean;            // Net Investment Income Tax (Form 8960, 3.8%)
  // NY State & City IT-201 lines
  nyAgi: number;               // Form IT-201 Line 33
  nyDeductions: number;        // Form IT-196 Itemized Deductions
  nyTaxableIncome: number;     // Form IT-201 Line 38
  nysTax: number;              // Form IT-201 Line 46
  nycTax: number;              // Form IT-201 Line 50
  // Application Mode
  rateModeToApply: 'marginal' | 'effective';
}

export interface TaxReturnAnalysis {
  effectiveFederalRate: number;
  marginalFederalRate: number;
  effectiveNysRate: number;
  marginalNysRate: number;
  effectiveNycRate: number;
  marginalNycRate: number;
  effectiveCombinedRate: number;
  marginalCombinedRate: number;
  nyClawbackPct: number;
  appliedProfile: TaxProfile;
}

export interface LoanConstants {
  propertyAddress: string;
  propertyType: string;
  purchasePrice: number;
  originalLoanDate: string;
  originalBalance: number;
  loanNumber: string;
  borrowerName: string;
  statementBalance: number; // 09/01/2026: $1,091,755.20
  activeStartingBalance: number; // Post 10/01/2026: $1,090,532.21
  currentInterestRate: number; // 5.750% (0.0575)
  currentMonthlyPI: number; // $6,454.32
  currentEscrow: number; // $632.55
  totalRemainingMonths: number; // 347
  fixedMonthsRemaining: number; // 107 (until 09/01/2035)
  variableMonthsRemaining: number; // 240
  armMargin: number; // 2.75%
  sofrAverage30Day: number; // 30-day average SOFR
  maxFirstResetRate: number; // 10.750%
  lifetimeCap: number; // 10.750%
  rateFloor: number; // 2.750%
  statutoryCaps: {
    federalAcquisitionCap: number; // $750,000.00
    nyDecoupledCap: number; // $1,000,000.00
    conformingBaseline2026: number; // $832,750.00
    kingsCountyHighBalance2026: number; // $1,209,750.00
  };
}

export interface AmortizationMonth {
  month: number;
  dateStr: string;
  balance: number;
  interest: number;
  principal: number;
  extraPrincipal: number;
  totalPayment: number;
  isFixedPeriod: boolean;
  rate: number;
}

export interface StrategySimulationResult {
  endFixedBalance: number; // Balance on 09/01/2035 (month 107)
  fixedPeriodInterestPaid: number; // Total interest paid over 107 months
  fixedPeriodInterestSaved: number; // vs Baseline $519,359.92 (or $524,591.27 including Oct 2026)
  effectiveMonthlyPayment: number; // Contractual required P&I floor (P_recast)
  cashFlowPayment: number; // Actual total out-of-pocket P&I paid
  postResetRate: number; // e.g. 10.75% or selected slider rate
  postResetMonthlyPI: number; // Required P&I after 09/01/2035 across 240 remaining months
  fullSchedule: AmortizationMonth[];
  tierBreakdown: {
    tier1: number; // Above $1,000,000
    tier2: number; // $750,000 to $1,000,000
    tier3: number; // $0 to $750,000
  };
  marginalAfterTaxCost: number; // After-tax interest cost on next dollar
  // Module B Enhanced Servicing Architecture
  isRecastQualified: boolean; // lumpSum >= $10,000
  strategyMode: LumpSumStrategyMode;
  recastRequiredMonthlyPI: number; // P_recast
  recastIncrementalPrincipal: number; // Delta_recast ($6,454.32 - P_recast in Mode A, $0 in Mode B)
  totalMonthlyIncrementalPrincipal: number; // P_incremental = Delta_recast + recurring extra
  totalOutOfPocketMonthlyPI: number; // P_total
  monthlyCashFlowRelief: number; // $0 in Mode A, $6,454.32 - P_recast in Mode B
  annualCashFlowRelief: number; // 12 * monthlyCashFlowRelief
  crossingMonthNYCap: number | null; // Month when balance crosses below $1,000,000
  crossingMonthFedCap: number | null; // Month when balance crosses below $750,000
  cumulativeIncrementalPrincipalRetired: number;
}

export interface AssetBenchmark {
  id: string;
  name: string;
  category: 'Mortgage' | 'Cash / Fixed Income' | 'Equities';
  preTaxYield: number;
  effectiveTaxRate: number;
  afterTaxYield: number;
  hurdleRateToBeatMortgage: number;
  terminalValue107Mo: number;
  volatilityBand?: {
    low: number;
    high: number;
    lowTerminal: number;
    highTerminal: number;
  };
  taxTreatmentNotes: string;
}

