import { useEffect, useState } from 'react';

export interface RatePoint {
  date: string;
  value: number; // percent, e.g. 6.625
  live?: boolean;
}

export interface RateSeries {
  fredId: string;
  label: string;
  frequency: 'daily' | 'weekly';
  latest: RatePoint;
  effectiveLatest?: RatePoint;
  relationshipDiscount?: number;
  spreadVsJumbo30?: number;
  points: RatePoint[];
}

export type RateSeriesKey =
  | 'wf7YrArm'
  | 'wf30YrJumbo'
  | 'jumbo30'
  | 'conforming30'
  | 'conforming15'
  | 'treasury10'
  | 'sofr30';

export interface WfProductConfig {
  productName?: string;
  label?: string;
  quotedBaseRate?: number | null;
  spreadVsJumbo30?: number;
  relationshipDiscount?: number;
  fixedPeriodMonths?: number;
}

export interface WellsFargoBrooklynProduct {
  productName: string;
  productType: string;
  loanType: string;
  loanTerm: string;
  loanAmount: number;
  interestRate: number;
  effectiveRate: number;
  apr: number;
  monthlyPaymentAmount: number;
  fullyIndexedRate: number | null;
  firstAdjustmentPeriod: number;
  discountPointsPercent: number;
  discountPointsAmount: number;
  closingCostAmount: number;
  creditScore: number;
}

export interface WellsFargoBrooklynSnapshot {
  date: string;
  city: string;
  county: string;
  stateCode: string;
  fipsCode: string;
  homeValue: number;
  mortgageBalance: number;
  timeStampMessage: string;
  relationshipDiscount: number;
  products: WellsFargoBrooklynProduct[];
}

export interface RatesPayload {
  generatedAt: string;
  source: string;
  alertConfig: {
    currentNoteRate?: number;
    relationshipDiscount?: number;
    benchmarkSeries?: RateSeriesKey;
    wf7YrArm?: WfProductConfig;
    wf30YrJumbo?: WfProductConfig;
    alertEffectiveRate?: number;
    watchEffectiveRate?: number;
  };
  wellsFargoBrooklyn?: WellsFargoBrooklynSnapshot | null;
  series: Partial<Record<RateSeriesKey, RateSeries>>;
}

interface UseRatesResult {
  data: RatesPayload | null;
  error: string | null;
  loading: boolean;
}

/**
 * Loads the market-rate snapshot (public/rates.json) that GitHub Actions
 * refreshes every weekday from Wells Fargo (Brooklyn / Kings County, NY) and FRED.
 */
export function useRates(): UseRatesResult {
  const [state, setState] = useState<UseRatesResult>({ data: null, error: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    const url = `${import.meta.env.BASE_URL}rates.json?t=${Math.floor(Date.now() / 3600000)}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<RatesPayload>;
      })
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ data: null, error: err.message, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
