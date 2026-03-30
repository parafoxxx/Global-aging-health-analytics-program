import { useQuery as useReactQuery } from "@tanstack/react-query";

export type CountryDoc = {
  country: string;
  total_count: number;
  frail_count: number;
  non_frail_count: number;
  frail_percentage: number;
  avg_age: number;
  female_count: number;
  male_count: number;
  female_percentage: number;
  male_percentage: number;
  comorbidity_yes: number;
  comorbidity_no: number;
  comorbidity_percentage: number;
  age_groups: Record<string, number>;
  health_ratings: Record<string, number>;
  marital_status: Record<string, number>;
  marriage_age_categories: Record<string, number>;
};

export type CountryFactorsDoc = {
  country: string;
  accuracy: number | null;
  factors: Array<{
    rank: number;
    name: string;
    score: number;
  }>;
};

function resolveSqlApiBaseUrl() {
  const configured = import.meta.env.VITE_SQL_API_BASE_URL?.trim();
  if (configured) {
    return configured;
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:4000`;
  }

  return "http://localhost:4000";
}

const SQL_API_BASE = resolveSqlApiBaseUrl();

async function getSqlCountries(): Promise<CountryDoc[]> {
  const res = await fetch(`${SQL_API_BASE}/api/countries`);
  if (!res.ok) throw new Error(`Failed to fetch countries: ${res.status}`);
  return res.json();
}

async function getSqlCountryByName(country: string): Promise<CountryDoc | null> {
  const res = await fetch(`${SQL_API_BASE}/api/countries/${encodeURIComponent(country)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch country: ${res.status}`);
  return res.json();
}

async function getSqlCountryFactors(country: string): Promise<CountryFactorsDoc | null> {
  const res = await fetch(`${SQL_API_BASE}/api/countries/${encodeURIComponent(country)}/factors`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch country factors: ${res.status}`);
  return res.json();
}

export function useCountriesData() {
  const sqlCountries = useReactQuery({
    queryKey: ["sql-countries"],
    queryFn: getSqlCountries,
    staleTime: 60_000,
  });

  return {
    data: sqlCountries.data,
    isLoading: sqlCountries.isLoading,
    isError: sqlCountries.isError,
    error: sqlCountries.error,
  };
}

export function useCountryFactorsData(country: string | undefined) {
  const sqlFactors = useReactQuery({
    queryKey: ["sql-country-factors", country],
    queryFn: () => getSqlCountryFactors(country ?? ""),
    enabled: Boolean(country),
    staleTime: 60_000,
  });

  return {
    data: sqlFactors.data,
    isLoading: sqlFactors.isLoading,
    isError: sqlFactors.isError,
    error: sqlFactors.error,
  };
}

export function useCountryByNameData(country: string | undefined) {
  const sqlCountry = useReactQuery({
    queryKey: ["sql-country", country],
    queryFn: () => getSqlCountryByName(country ?? ""),
    enabled: Boolean(country),
    staleTime: 60_000,
  });

  return {
    data: sqlCountry.data,
    isLoading: sqlCountry.isLoading,
    isError: sqlCountry.isError,
    error: sqlCountry.error,
  };
}
