import type { LoanConstants, TaxProfile, TaxReturnInputs } from '../types/financial';

export const BASELINE_LOAN: LoanConstants = {
  propertyAddress: '323 Bergen St, Brooklyn, NY 11217',
  propertyType: 'Kings County 1-Bed Condo (775 sq ft)',
  purchasePrice: 1390000.0,
  originalLoanDate: '2025-09-01',
  originalBalance: 1106000.0,
  loanNumber: '',
  borrowerName: 'Primary Borrower',
  statementBalance: 1091755.20,

  activeStartingBalance: 1090532.21,
  currentInterestRate: 0.0575, // 5.750%
  currentMonthlyPI: 6454.32,
  currentEscrow: 632.55,
  totalRemainingMonths: 347,
  fixedMonthsRemaining: 107, // Until 09/01/2035 reset
  variableMonthsRemaining: 240, // 2035 to 2055
  armMargin: 0.0275, // 2.75%
  sofrAverage30Day: 0.0485, // Illustrative recent 30-day SOFR
  maxFirstResetRate: 0.1075, // 10.750% (5% initial cap above 5.75%)
  lifetimeCap: 0.1075, // 10.750% (5/1/5 cap structure)
  rateFloor: 0.0275, // 2.750% margin floor
  statutoryCaps: {
    federalAcquisitionCap: 750000.0,
    nyDecoupledCap: 1000000.0,
    conformingBaseline2026: 832750.0,
    kingsCountyHighBalance2026: 1209750.0,
  },
};

export const TAX_PROFILES: Record<string, TaxProfile> = {
  profile_a: {
    id: 'profile_a',
    name: 'Profile A: Baseline (Tax Return)',
    description: 'Current Tax Return Rates: 35.0% Fed / 6.85% NYS / 3.876% NYC / 3.8% NIIT (0% Comp Growth Baseline)',
    federalRate: 0.35,
    nysRate: 0.0685,
    nycRate: 0.03876,
    niitRate: 0.038,
    ltcgRate: 0.15,
    nyClawbackPct: 0.50,
    compGrowthAnnualPct: 0.0,
    projectedYear9Agi: 550000,
    rateDeltaCombined: 0.0,
    bracketNote: 'Baseline tax rates directly calibrated from Form 1040 & IT-201 returns at constant earnings ($550k AGI).',
  },
  profile_b: {
    id: 'profile_b',
    name: 'Profile B: Moderate Comp Growth (+7.5%/yr)',
    description: '37.0% Fed / 9.65% NYS / 3.876% NYC / 3.8% NIIT / 20% LTCG (+4.80% Tax Drag, $1.05M Projected AGI)',
    federalRate: 0.37,
    nysRate: 0.0965,
    nycRate: 0.03876,
    niitRate: 0.038,
    ltcgRate: 0.20,
    nyClawbackPct: 1.00,
    compGrowthAnnualPct: 0.075,
    projectedYear9Agi: 1048642,
    rateDeltaCombined: 0.0480,
    bracketNote: 'Crosses Federal 37% top bracket ($609k) & $1M NY threshold: NYS jumps to 9.65%, NY itemized clawback hits 100% (0% mortgage deduction).',
  },
  profile_c: {
    id: 'profile_c',
    name: 'Profile C: Aggressive Comp Growth (+15.0%/yr)',
    description: '37.0% Fed / 10.30% NYS / 3.876% NYC / 3.8% NIIT / 20% LTCG (+5.45% Tax Drag, $1.93M Projected AGI)',
    federalRate: 0.37,
    nysRate: 0.1030,
    nycRate: 0.03876,
    niitRate: 0.038,
    ltcgRate: 0.20,
    nyClawbackPct: 1.00,
    compGrowthAnnualPct: 0.15,
    projectedYear9Agi: 1929885,
    rateDeltaCombined: 0.0545,
    bracketNote: 'AGI reaches ~$1.93M: Hits Federal 37%, NYS 10.30% multi-millionaire bracket, 20% LTCG, and 100% deduction clawback.',
  },
};


export const DEFAULT_TAX_RETURN_INPUTS: TaxReturnInputs = {
  taxYear: 2025,
  filingStatus: 'single',
  federalAgi: 550000,
  federalDeductions: 68400,
  federalTaxableIncome: 481600,
  federalTotalTax: 138500,
  hasNiit: true,
  nyAgi: 550000,
  nyDeductions: 82500,
  nyTaxableIncome: 467500,
  nysTax: 35200,
  nycTax: 19500,
  rateModeToApply: 'marginal',
};


export const PRESET_CURTAILMENTS = [
  { label: '$0 Baseline', value: 0 },
  { label: '$50,000', value: 50000 },
  { label: '$90,532.21 (Clear Tier 1 to $1M Cap)', value: 90532.21 },
  { label: '$100,000', value: 100000 },
  { label: '$257,782 (Reach $832.75k Conforming)', value: 257782.21 },
  { label: '$340,532.21 (Clear Tier 1 & 2 to $750k Cap)', value: 340532.21 },
];

export const PRESET_EXTRA_MONTHLIES = [
  { label: '$0/mo', value: 0 },
  { label: '$537.86/mo (Bi-Weekly Equiv)', value: 537.86 },
  { label: '$1,000/mo', value: 1000 },
  { label: '$2,000/mo', value: 2000 },
];

export const AUDIT_CHECKPOINTS = {
  baselineEndingBalance: 919279.91,
  baselineFixedInterestPaid: 519359.92, // + Oct 2026 interest = $524,591.27
  strategy9EndingBalance: 768293.48,
  strategy9InterestSaved: 60454.22,
  strategy10RecastPmt: 5918.41,
  strategy10InterestSaved: 43112.41,
  strategy13EndingBalance: 628934.05,
  strategy13InterestSaved: 92813.65,
  strategy13ResetPayment1075: 6385.12,
};
