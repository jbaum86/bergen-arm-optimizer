import { useEffect, useState } from 'react';

export interface RatePoint {
  date: string;
  value: number; // percent, e.g. 7.094
}

export interface RateSeries {
  fredId: string;
  label: string;
  frequency: 'daily' | 'weekly';
  latest: RatePoint;
  points: RatePoint[];
}

export type RateSeriesKey = 'jumbo30' | 'conforming30' | 'conforming15' | 'treasury10' | 'sofr30';

export interface RatesPayload {
  generatedAt: string;
  source: string;
  alertConfig: {
    currentNoteRate?: number;
    relationshipDiscount?: number;
    benchmarkSeries?: RateSeriesKey;
    alertEffectiveRate?: number;
    watchEffectiveRate?: number;
  };
  series: Partial<Record<RateSeriesKey, RateSeries>>;
}

interface UseRatesResult {
  data: RatesPayload | null;
  error: string | null;
  loading: boolean;
}

/**
 * Loads the market-rate snapshot (public/rates.json) that GitHub Actions
 * refreshes every weekday from FRED. Fetched at runtime so the dashboard
 * always shows the latest deployed snapshot.
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

