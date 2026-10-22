import type { LoanConstants, TaxProfile, RelationshipDiscountTier } from '../types/financial';

export const BASELINE_LOAN: LoanConstants = {
  propertyAddress: '323 Bergen St Apt 408W, Brooklyn, NY 11217',
  propertyType: 'Kings County 1-Bed Condo (775 sq ft)',
  purchasePrice: 1390000.0,
  originalLoanDate: '2025-09-01',
  originalBalance: 1106000.0,
  loanNumber: '0813684933',
  borrowerName: 'Samantha Martin',
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
    name: 'Profile A (Upper-Middle)',
    description: '32% Fed / 6.85% NYS / 3.876% NYC / 3.8% NIIT / 15% LTCG (25% NY Clawback)',
    federalRate: 0.32,
    nysRate: 0.0685,
    nycRate: 0.03876,
    niitRate: 0.038,
    ltcgRate: 0.15,
    nyClawbackPct: 0.25,
  },
  profile_b: {
    id: 'profile_b',
    name: 'Profile B (High Earner — Default)',
    description: '35% Fed / 6.85% NYS / 3.876% NYC / 3.8% NIIT / 15% LTCG (50% NY Clawback)',
    federalRate: 0.35,
    nysRate: 0.0685,
    nycRate: 0.03876,
    niitRate: 0.038,
    ltcgRate: 0.15,
    nyClawbackPct: 0.50,
  },
  profile_c: {
    id: 'profile_c',
    name: 'Profile C (Top Bracket / Ultra-High)',
    description: '37% Fed / 9.65% NYS / 3.876% NYC / 3.8% NIIT / 20% LTCG (100% NY Clawback)',
    federalRate: 0.37,
    nysRate: 0.0965,
    nycRate: 0.03876,
    niitRate: 0.038,
    ltcgRate: 0.20,
    nyClawbackPct: 1.00,
  },
};

export const RELATIONSHIP_DISCOUNT_TIERS: RelationshipDiscountTier[] = [
  {
    label: '$0 – $19,999 Assets',
    minAssets: 0,
    maxAssets: 19999,
    rateDiscount: 0.0,
    closingCostCredit: 0,
  },
  {
    label: '$20,000 – $249,999 Assets',
    minAssets: 20000,
    maxAssets: 249999,
    rateDiscount: 0.0,
    closingCostCredit: 500,
  },
  {
    label: '$250,000 – $499,999 Assets',
    minAssets: 250000,
    maxAssets: 499999,
    rateDiscount: 0.00125, // -0.125%
    closingCostCredit: 0,
  },
  {
    label: '$500,000 – $999,999 Assets',
    minAssets: 500000,
    maxAssets: 999999,
    rateDiscount: 0.0025, // -0.250%
    closingCostCredit: 0,
  },
  {
    label: '$1,000,000+ Transferred Assets',
    minAssets: 1000000,
    maxAssets: 4999999,
    rateDiscount: 0.0050, // -0.500%
    closingCostCredit: 0,
  },
  {
    label: '$5,000,000+ Private Client Tier',
    minAssets: 5000000,
    maxAssets: 999999999,
    rateDiscount: 0.0075, // -0.750% (can scale up to -1.250%)
    closingCostCredit: 0,
  },
];

export const REFINANCE_RATE_BENCHMARKS = [
  { label: 'October 2026 30-Yr Jumbo', rate: 0.0745 },
  { label: 'NY High-Balance Conforming', rate: 0.0725 },
  { label: '15-Yr Jumbo Benchmark', rate: 0.0691 },
  { label: '7/6m ARM Benchmark', rate: 0.0650 },
  { label: 'Future Target Refi Rate', rate: 0.0500 },
];

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
