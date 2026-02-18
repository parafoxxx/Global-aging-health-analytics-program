import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { useQuery } from "convex/react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import {
  ActivityIcon,
  ArrowLeftIcon,
  BrainCircuitIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const MAX_COMPARE = 5;
const MIN_COMPARE = 2;
const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

type CountryDoc = {
  country: string;
  total_count: number;
  frail_percentage: number;
  comorbidity_percentage: number;
  avg_age: number;
  female_percentage: number;
  age_groups: Record<string, number>;
  health_ratings: Record<string, number>;
};

type InsightItem = {
  severity: "high" | "medium" | "low";
  message: string;
  action: string;
};

const getFrailtyColor = (frailty: number | undefined, minFrailty: number, maxFrailty: number) => {
  if (frailty === undefined || frailty === null) return "#d6d6da";
  const range = Math.max(maxFrailty - minFrailty, 0.001);
  const t = Math.min(1, Math.max(0, (frailty - minFrailty) / range));
  return `oklch(${0.88 - t * 0.42} ${0.07 + t * 0.2} ${210 - t * 160})`;
};

function pickTopKeys(
  records: CountryDoc[],
  accessor: (country: CountryDoc) => Record<string, number>,
  maxKeys = 5,
) {
  const totals = new Map<string, number>();
  for (const country of records) {
    const record = accessor(country);
    for (const [key, value] of Object.entries(record)) {
      totals.set(key, (totals.get(key) ?? 0) + value);
    }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeys)
    .map(([key]) => key);
}

function insightsForCountry(
  country: CountryDoc,
  global: { frailty: number; comorbidity: number; age: number },
) {
  const insights: InsightItem[] = [];
  if (country.frail_percentage > global.frailty + 4) {
    insights.push({
      severity: "high",
      message: "Frailty is materially above the global average.",
      action: "Prioritize frailty-screening and prevention interventions.",
    });
  }
  if (country.comorbidity_percentage > global.comorbidity + 5) {
    insights.push({
      severity: "high",
      message: "Comorbidity burden is high and likely linked to frailty risk.",
      action: "Strengthen chronic-disease management and integrated geriatric care.",
    });
  }
  if (country.avg_age > global.age + 2) {
    insights.push({
      severity: "medium",
      message: "Older participant profile may be influencing risk outcomes.",
      action: "Segment analyses by age cohort before policy decisions.",
    });
  }
  if (country.female_percentage > 60 || country.female_percentage < 40) {
    insights.push({
      severity: "medium",
      message: "Gender distribution is skewed and may affect interpretation.",
      action: "Use sex-stratified results for interpretation and planning.",
    });
  }
  const poorShare = Object.entries(country.health_ratings ?? {})
    .filter(([key]) => /poor/i.test(key))
    .reduce((sum, [, value]) => sum + value, 0);
  const poorPercent = country.total_count > 0 ? (poorShare / country.total_count) * 100 : 0;
  if (poorPercent > 25) {
    insights.push({
      severity: "high",
      message: "Self-reported poor health responses are elevated.",
      action: "Investigate service access and social determinants in high-risk groups.",
    });
  }
  if (insights.length === 0) {
    insights.push({
      severity: "low",
      message: "Metrics are close to overall averages with no extreme signals.",
      action: "Maintain current interventions and continue routine monitoring.",
    });
  }
  return insights.slice(0, 3);
}

export default function MapPage() {
  const navigate = useNavigate();
  const countries = useQuery(api.countries.getAllCountries) as CountryDoc[] | undefined;
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  useEffect(() => {
    setSearchInput(searchParams.get("search") ?? "");
  }, [searchParams]);

  const countriesByName = useMemo(
    () => new Map((countries ?? []).map((country) => [country.country, country])),
    [countries],
  );

  const filteredCountries = useMemo(() => {
    if (!countries) return [];
    const query = searchInput.trim().toLowerCase();
    if (!query) return countries;
    return countries.filter((country) => country.country.toLowerCase().includes(query));
  }, [countries, searchInput]);

  useEffect(() => {
    if (!countries || countries.length === 0) return;
    setSelectedCountries((prev) => {
      if (prev.length >= MIN_COMPARE) return prev;
      return countries.slice(0, MIN_COMPARE).map((item) => item.country);
    });
  }, [countries]);

  const selectedCountryDocs = useMemo(
    () =>
      selectedCountries
        .map((name) => countriesByName.get(name))
        .filter((item): item is CountryDoc => Boolean(item)),
    [selectedCountries, countriesByName],
  );

  const frailtyRange = useMemo(() => {
    if (!countries || countries.length === 0) return { minFrailty: 0, maxFrailty: 1 };
    const values = countries.map((country) => country.frail_percentage);
    return { minFrailty: Math.min(...values), maxFrailty: Math.max(...values) };
  }, [countries]);

  const topFrailtyCountries = useMemo(
    () => [...filteredCountries].sort((a, b) => b.frail_percentage - a.frail_percentage).slice(0, 8),
    [filteredCountries],
  );

  const summary = useMemo(() => {
    if (!filteredCountries.length) return { participants: 0, avgAge: 0 };
    return {
      participants: filteredCountries.reduce((sum, country) => sum + country.total_count, 0),
      avgAge:
        filteredCountries.reduce((sum, country) => sum + country.avg_age, 0) /
        filteredCountries.length,
    };
  }, [filteredCountries]);

  const globalBaseline = useMemo(() => {
    if (!countries || countries.length === 0) return { frailty: 0, comorbidity: 0, age: 0 };
    return {
      frailty: countries.reduce((sum, c) => sum + c.frail_percentage, 0) / countries.length,
      comorbidity: countries.reduce((sum, c) => sum + c.comorbidity_percentage, 0) / countries.length,
      age: countries.reduce((sum, c) => sum + c.avg_age, 0) / countries.length,
    };
  }, [countries]);

  const comparisonOverview = useMemo(
    () =>
      selectedCountryDocs.map((country) => ({
        country: country.country,
        frailty: Number(country.frail_percentage.toFixed(2)),
        comorbidity: Number(country.comorbidity_percentage.toFixed(2)),
        avgAge: Number(country.avg_age.toFixed(2)),
      })),
    [selectedCountryDocs],
  );

  const ageKeys = useMemo(() => pickTopKeys(selectedCountryDocs, (country) => country.age_groups, 5), [selectedCountryDocs]);
  const healthKeys = useMemo(
    () => pickTopKeys(selectedCountryDocs, (country) => country.health_ratings, 5),
    [selectedCountryDocs],
  );

  const ageMixComparison = useMemo(
    () =>
      selectedCountryDocs.map((country) => {
        const row: Record<string, number | string> = { country: country.country };
        for (const key of ageKeys) {
          const value = country.age_groups?.[key] ?? 0;
          row[key] = country.total_count > 0 ? Number(((value / country.total_count) * 100).toFixed(1)) : 0;
        }
        return row;
      }),
    [selectedCountryDocs, ageKeys],
  );

  const healthMixComparison = useMemo(
    () =>
      selectedCountryDocs.map((country) => {
        const row: Record<string, number | string> = { country: country.country };
        for (const key of healthKeys) {
          const value = country.health_ratings?.[key] ?? 0;
          row[key] = country.total_count > 0 ? Number(((value / country.total_count) * 100).toFixed(1)) : 0;
        }
        return row;
      }),
    [selectedCountryDocs, healthKeys],
  );

  const comparisonRank = useMemo(() => {
    if (selectedCountryDocs.length < MIN_COMPARE) return null;
    const highestFrailty = [...selectedCountryDocs].sort((a, b) => b.frail_percentage - a.frail_percentage)[0];
    const lowestFrailty = [...selectedCountryDocs].sort((a, b) => a.frail_percentage - b.frail_percentage)[0];
    const highestComorbidity = [...selectedCountryDocs].sort(
      (a, b) => b.comorbidity_percentage - a.comorbidity_percentage,
    )[0];
    return { highestFrailty, lowestFrailty, highestComorbidity };
  }, [selectedCountryDocs]);

  const applySearch = () => {
    const query = searchInput.trim();
    if (query) {
      setSearchParams({ search: query });
      return;
    }
    setSearchParams({});
  };

  const toggleCountrySelection = (countryName: string) => {
    setSelectedCountries((prev) => {
      if (prev.includes(countryName)) return prev.filter((name) => name !== countryName);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, countryName];
    });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_38%),linear-gradient(to_bottom,var(--background),color-mix(in_oklch,var(--accent)_25%,var(--background)))] px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <h1 className="text-3xl font-serif font-bold md:text-4xl">Global Frailty Atlas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hover countries for details. Compare 2 to 5 countries in the panel below.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeftIcon className="mr-2 size-4" />
              Home
            </Button>
            <Button onClick={() => navigate("/map")}>Reset View</Button>
          </div>
        </motion.div>

        <div className="mb-6 rounded-2xl border bg-card/85 p-4 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && applySearch()}
                className="pl-10"
                placeholder="Filter countries by name"
              />
            </div>
            <Button onClick={applySearch} className="md:w-auto">
              <SlidersHorizontalIcon className="mr-2 size-4" />
              Apply Filter
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSearchInput("");
                setSearchParams({});
              }}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <Card className="overflow-hidden">
            <CardContent className="relative p-4 md:p-6">
              <div className="absolute left-3 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-2 md:flex">
                <div className="text-[11px] font-semibold text-muted-foreground">Frailty %</div>
                <div className="h-56 w-4 overflow-hidden rounded-md border">
                  {Array.from({ length: 100 }).map((_, i) => {
                    const value = frailtyRange.maxFrailty - (i / 99) * (frailtyRange.maxFrailty - frailtyRange.minFrailty);
                    return (
                      <div
                        key={i}
                        data-tooltip-id="scale-tooltip"
                        data-tooltip-content={`${value.toFixed(1)}%`}
                        style={{
                          height: "1%",
                          background: getFrailtyColor(value, frailtyRange.minFrailty, frailtyRange.maxFrailty),
                        }}
                      />
                    );
                  })}
                </div>
                <div className="text-[10px] text-muted-foreground">Low to high</div>
              </div>

              {countries === undefined ? (
                <Skeleton className="h-[540px] w-full rounded-xl" />
              ) : (
                <ComposableMap projectionConfig={{ scale: 150 }} className="w-full">
                  <Geographies geography={geoUrl}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const countryName = geo.properties.name as string;
                        const countryData = countriesByName.get(countryName);
                        const query = searchInput.trim().toLowerCase();
                        const isMatched = query.length === 0 || countryName.toLowerCase().includes(query);
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            data-tooltip-id="country-tooltip"
                            data-tooltip-content={
                              countryData
                                ? `${countryData.country} | Frailty ${countryData.frail_percentage.toFixed(1)}% | ${countryData.total_count.toLocaleString()} participants`
                                : `${countryName} | No data`
                            }
                            onClick={() => {
                              if (countryData) navigate(`/country/${encodeURIComponent(countryData.country)}`);
                            }}
                            style={{
                              default: {
                                fill: getFrailtyColor(countryData?.frail_percentage, frailtyRange.minFrailty, frailtyRange.maxFrailty),
                                stroke: isMatched ? "#4c5467" : "#8d94a5",
                                strokeWidth: isMatched ? 0.55 : 0.3,
                                opacity: isMatched ? 1 : 0.4,
                                outline: "none",
                              },
                              hover: {
                                fill: countryData
                                  ? getFrailtyColor(countryData.frail_percentage, frailtyRange.minFrailty, frailtyRange.maxFrailty)
                                  : "#9da3b0",
                                stroke: "#ffffff",
                                strokeWidth: 1,
                                outline: "none",
                                cursor: countryData ? "pointer" : "default",
                              },
                              pressed: {
                                fill: "oklch(0.48 0.1 245)",
                                stroke: "#ffffff",
                                strokeWidth: 1,
                                outline: "none",
                              },
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ComposableMap>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtered Highlights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Countries</p>
                  <p className="text-xl font-bold">{filteredCountries.length}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Participants</p>
                  <p className="text-xl font-bold">{summary.participants.toLocaleString()}</p>
                </div>
              </div>
              <div className="rounded-xl border p-3 text-center">
                <p className="text-xs text-muted-foreground">Average Age</p>
                <p className="text-2xl font-bold">{summary.avgAge.toFixed(1)}</p>
              </div>
              <div className="pt-2">
                <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ActivityIcon className="size-3.5" />
                  Top frailty in current filter
                </p>
                <div className="max-h-[340px] space-y-2 overflow-auto pr-1">
                  {topFrailtyCountries.map((country) => (
                    <button
                      key={country.country}
                      onClick={() => toggleCountrySelection(country.country)}
                      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${
                        selectedCountries.includes(country.country)
                          ? "border-primary/60 bg-primary/5"
                          : "hover:border-primary/40 hover:bg-accent/30"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold">{country.country}</p>
                        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <UsersIcon className="size-3.5" />
                          {country.total_count.toLocaleString()}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-primary">{country.frail_percentage.toFixed(1)}%</p>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <section className="mt-8 grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Country Comparison Mode</CardTitle>
              <CardDescription>
                Select {MIN_COMPARE} to {MAX_COMPARE} countries. Click chips below to add/remove.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {selectedCountries.map((country) => (
                  <button
                    key={country}
                    onClick={() => toggleCountrySelection(country)}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                  >
                    {country}
                    <XIcon className="size-3.5" />
                  </button>
                ))}
                {selectedCountries.length === 0 && (
                  <span className="text-sm text-muted-foreground">No countries selected yet.</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {filteredCountries
                  .filter((country) => !selectedCountries.includes(country.country))
                  .map((country) => (
                    <button
                      key={country.country}
                      onClick={() => toggleCountrySelection(country.country)}
                      disabled={selectedCountries.length >= MAX_COMPARE}
                      className="rounded-full border px-3 py-1 text-xs font-medium hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {country.country}
                    </button>
                  ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Selected: {selectedCountries.length}/{MAX_COMPARE}
              </p>
              {selectedCountries.length > 0 && selectedCountries.length < MIN_COMPARE && (
                <p className="text-xs text-amber-600">
                  Select at least {MIN_COMPARE} countries to activate analytics.
                </p>
              )}
            </CardContent>
          </Card>

          {selectedCountryDocs.length >= MIN_COMPARE ? (
            <>
              {comparisonRank && (
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Highest Frailty</p>
                      <p className="mt-1 text-lg font-semibold">{comparisonRank.highestFrailty.country}</p>
                      <p className="text-sm text-primary">
                        {comparisonRank.highestFrailty.frail_percentage.toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Lowest Frailty</p>
                      <p className="mt-1 text-lg font-semibold">{comparisonRank.lowestFrailty.country}</p>
                      <p className="text-sm text-primary">
                        {comparisonRank.lowestFrailty.frail_percentage.toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Highest Comorbidity</p>
                      <p className="mt-1 text-lg font-semibold">{comparisonRank.highestComorbidity.country}</p>
                      <p className="text-sm text-primary">
                        {comparisonRank.highestComorbidity.comorbidity_percentage.toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Frailty vs Comorbidity Comparison</CardTitle>
                    <CardDescription>Side-by-side burden profile across selected countries</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={{
                        frailty: { label: "Frailty %", color: "var(--chart-1)" },
                        comorbidity: { label: "Comorbidity %", color: "var(--chart-2)" },
                        avgAge: { label: "Avg Age", color: "var(--chart-5)" },
                      }}
                      className="h-[320px] w-full"
                    >
                      <ComposedChart data={comparisonOverview} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="country" tickLine={false} axisLine={false} />
                        <YAxis yAxisId="left" tickLine={false} axisLine={false} />
                        <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} />
                        <Legend />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar yAxisId="left" dataKey="frailty" fill="var(--chart-1)" radius={6} />
                        <Bar yAxisId="left" dataKey="comorbidity" fill="var(--chart-2)" radius={6} />
                        <Line yAxisId="right" dataKey="avgAge" stroke="var(--chart-5)" strokeWidth={2.5} dot={{ r: 4 }} />
                      </ComposedChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Age Mix Comparison</CardTitle>
                    <CardDescription>Percent share by dominant age groups</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={ageMixComparison} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="country" tickLine={false} axisLine={false} />
                          <YAxis tickLine={false} axisLine={false} unit="%" />
                          <RechartsTooltip />
                          <Legend />
                          {ageKeys.map((key, index) => (
                            <Bar key={key} dataKey={key} stackId="age" fill={PALETTE[index % PALETTE.length]} radius={index === ageKeys.length - 1 ? 6 : 0} />
                          ))}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Health Ratings Comparison</CardTitle>
                    <CardDescription>Side-by-side share of dominant self-reported health ratings</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={healthMixComparison} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="country" tickLine={false} axisLine={false} />
                          <YAxis tickLine={false} axisLine={false} unit="%" />
                          <RechartsTooltip />
                          <Legend />
                          {healthKeys.map((key, index) => (
                            <Bar key={key} dataKey={key} stackId="health" fill={PALETTE[index % PALETTE.length]} radius={index === healthKeys.length - 1 ? 6 : 0} />
                          ))}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="inline-flex items-center gap-2">
                      <BrainCircuitIcon className="size-4 text-muted-foreground" />
                      Smart Insights Panel
                    </CardTitle>
                    <CardDescription>
                      Auto-generated findings with severity labels and recommended actions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedCountryDocs.map((country) => (
                      <div key={country.country} className="rounded-xl border p-3">
                        <p className="mb-2 text-sm font-semibold">{country.country}</p>
                        <div className="space-y-2">
                          {insightsForCountry(country, globalBaseline).map((insight) => (
                            <div
                              key={`${country.country}-${insight.message}`}
                              className="rounded-lg border bg-accent/25 p-2.5"
                            >
                              <div className="mb-1 flex items-center gap-2">
                                {insight.severity === "high" ? (
                                  <CircleAlertIcon className="size-3.5 text-destructive" />
                                ) : (
                                  <CircleCheckIcon className="size-3.5 text-primary" />
                                )}
                                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                  {insight.severity} priority
                                </span>
                              </div>
                              <p className="text-xs font-medium">{insight.message}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{insight.action}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                Select at least {MIN_COMPARE} countries to unlock side-by-side comparison and smart insights.
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      <Tooltip id="scale-tooltip" place="right" />
      <Tooltip id="country-tooltip" />
    </div>
  );
}
