import { useMemo, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { useQuery } from "convex/react";
import { ActivityIcon, ArrowLeftIcon, UserIcon, UsersIcon } from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

type SliceDatum = {
  label: string;
  value: number;
  percent: number;
  fill: string;
};

type PointDatum = {
  label: string;
  value: number;
  percent: number;
};

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function parseAgeOrder(label: string) {
  const match = label.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function toSlices(
  entries: [string, number][],
  total: number,
  labelTransform?: (label: string) => string,
): SliceDatum[] {
  return entries
    .sort(([, a], [, b]) => b - a)
    .map(([label, value], index) => ({
      label: labelTransform ? labelTransform(label) : label,
      value,
      percent: total > 0 ? (value / total) * 100 : 0,
      fill: PALETTE[index % PALETTE.length],
    }));
}

function toPoints(
  entries: [string, number][],
  total: number,
  sortFn?: (a: [string, number], b: [string, number]) => number,
  labelTransform?: (label: string) => string,
): PointDatum[] {
  const sorted = sortFn ? [...entries].sort(sortFn) : [...entries].sort(([, a], [, b]) => b - a);
  return sorted.map(([label, value]) => ({
    label: labelTransform ? labelTransform(label) : label,
    value,
    percent: total > 0 ? (value / total) * 100 : 0,
  }));
}

function DonutCard({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: SliceDatum[];
}) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="group relative overflow-hidden rounded-2xl border border-border/70 bg-accent/15 p-4 shadow-sm"
    >
      <div className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300 group-hover:opacity-90" style={{ background: "radial-gradient(circle at 85% 15%, color-mix(in oklch, var(--primary) 12%, transparent), transparent 45%)" }} />
      <div className="relative mb-3">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="relative grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
        <ChartContainer config={{ value: { label: "Participants", color: "var(--chart-1)" } }} className="h-[250px] w-full">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(_, __, item) => {
                    const p = item.payload as SliceDatum;
                    return (
                      <div className="flex min-w-[170px] items-center justify-between gap-4">
                        <span>{p.label}</span>
                        <span className="font-semibold">
                          {p.value.toLocaleString()} ({p.percent.toFixed(1)}%)
                        </span>
                      </div>
                    );
                  }}
                />
              }
            />
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={62} outerRadius={92} paddingAngle={2} isAnimationActive animationDuration={700} animationBegin={120}>
              {data.map((d) => (
                <Cell key={d.label} fill={d.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="divide-y rounded-lg border bg-background/40">
          {data.map((d) => (
            <div key={d.label} className="px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-2 font-medium">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                  {d.label}
                </span>
                <span className="text-muted-foreground">{d.percent.toFixed(1)}%</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{d.value.toLocaleString()} participants</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function GraphPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="group relative overflow-hidden rounded-2xl border border-border/70 bg-accent/15 p-4 shadow-sm"
    >
      <div className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300 group-hover:opacity-90" style={{ background: "radial-gradient(circle at 80% 12%, color-mix(in oklch, var(--chart-3) 13%, transparent), transparent 46%)" }} />
      <div className="relative mb-3">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="relative">{children}</div>
    </motion.div>
  );
}

export default function CountryPage() {
  const navigate = useNavigate();
  const { country: countryParam } = useParams<{ country: string }>();
  const country = useQuery(
    api.countries.getCountryByName,
    countryParam ? { country: decodeURIComponent(countryParam) } : "skip",
  );

  const frailtyStatus = useMemo(() => {
    if (!country) return "Unknown";
    if (country.frail_percentage >= 30) return "High";
    if (country.frail_percentage >= 18) return "Elevated";
    return "Moderate";
  }, [country]);

  if (country === undefined) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <Skeleton className="mb-6 h-10 w-36" />
          <Skeleton className="mb-8 h-20 w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-72 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!country) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <h1 className="text-3xl font-serif font-bold">Country not found</h1>
        <p className="text-muted-foreground">No analytics are available for this route.</p>
        <Button onClick={() => navigate("/map")}>
          <ArrowLeftIcon className="mr-2 size-4" />
          Return to map
        </Button>
      </div>
    );
  }

  const genderData = toSlices(
    [
      ["Female", country.female_count],
      ["Male", country.male_count],
    ],
    country.total_count,
  );

  const comorbidityData = toSlices(
    [
      ["With comorbidity", country.comorbidity_yes],
      ["Without comorbidity", country.comorbidity_no],
    ],
    country.total_count,
  );

  const ageTrendData = toPoints(
    Object.entries(country.age_groups ?? {}),
    country.total_count,
    ([a], [b]) => parseAgeOrder(a) - parseAgeOrder(b),
  );

  const healthRadarData = toPoints(Object.entries(country.health_ratings ?? {}), country.total_count);
  const maritalPieData = toSlices(Object.entries(country.marital_status ?? {}), country.total_count);
  const marriageAgeRadialData = toSlices(
    Object.entries(country.marriage_age_categories ?? {}),
    country.total_count,
    (label) => (label === ">18" ? "Married after 18" : "Married at or before 18"),
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_0%,color-mix(in_oklch,var(--chart-3)_12%,transparent),transparent_32%),linear-gradient(to_bottom,var(--background),color-mix(in_oklch,var(--accent)_26%,var(--background)))] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <Button variant="ghost" onClick={() => navigate("/map")} className="mb-5">
          <ArrowLeftIcon className="mr-2 size-4" />
          Back to map
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-8 rounded-3xl border bg-card/85 p-6 shadow-xl backdrop-blur"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-serif font-bold tracking-tight md:text-5xl">{country.country}</h1>
              <p className="mt-2 text-sm text-muted-foreground">Country-level health and frailty analytics</p>
            </div>
            <div className="rounded-xl border bg-accent/45 px-4 py-2 text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Frailty status</p>
              <p className="text-base font-semibold text-primary">{frailtyStatus}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.04 }}
          className="mb-8"
        >
          <Card>
            <CardHeader>
              <CardTitle>Country Summary</CardTitle>
              <CardDescription>Core population and frailty metrics</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3 md:gap-0">
              {[
                {
                  label: "Participants",
                  value: country.total_count.toLocaleString(),
                  icon: UsersIcon,
                  note: "Study sample size",
                },
                {
                  label: "Frailty rate",
                  value: `${country.frail_percentage.toFixed(2)}%`,
                  icon: ActivityIcon,
                  note: `${country.frail_count.toLocaleString()} classified as frail`,
                },
                {
                  label: "Average age",
                  value: `${country.avg_age.toFixed(1)} years`,
                  icon: UserIcon,
                  note: "Mean participant age",
                },
              ].map((item, index) => (
                <div
                  key={item.label}
                  className={`rounded-xl p-3 md:px-5 md:py-2 ${index > 0 ? "md:border-l" : ""}`}
                >
                  <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <item.icon className="size-4" />
                    {item.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold">{item.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Population Composition</CardTitle>
            <CardDescription>Gender and comorbidity split for this country sample</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <DonutCard
              title="Gender Distribution"
              description="Population split by sex"
              data={genderData}
            />
            <DonutCard
              title="Comorbidity Distribution"
              description="Participants with and without comorbidity"
              data={comorbidityData}
            />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Graph Insights</CardTitle>
            <CardDescription>Age, health, marital status, and marriage-age patterns in one view</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <GraphPanel
              title="Age Group Trend"
              description="Ordered distribution across age bands"
            >
              <ChartContainer config={{ value: { label: "Participants", color: "var(--chart-2)" } }} className="h-[320px] w-full">
                <LineChart data={ageTrendData} margin={{ left: 8, right: 18, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} minTickGap={18} interval="preserveStartEnd" />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        formatter={(_, __, item) => {
                          const p = item.payload as PointDatum;
                          return (
                            <div className="flex min-w-[160px] items-center justify-between gap-4">
                              <span>{p.label}</span>
                              <span className="font-semibold">
                                {p.value.toLocaleString()} ({p.percent.toFixed(1)}%)
                              </span>
                            </div>
                          );
                        }}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--chart-2)"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "var(--chart-2)" }}
                    activeDot={{ r: 6 }}
                    animationDuration={900}
                  />
                </LineChart>
              </ChartContainer>
            </GraphPanel>

            <GraphPanel
              title="Self-Reported Health Radar"
              description="Relative concentration across health ratings"
            >
              <ChartContainer config={{ value: { label: "Participants", color: "var(--chart-3)" } }} className="h-[320px] w-full">
                <RadarChart data={healthRadarData} outerRadius={112}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(_, __, item) => {
                          const p = item.payload as PointDatum;
                          return (
                            <div className="flex min-w-[160px] items-center justify-between gap-4">
                              <span>{p.label}</span>
                              <span className="font-semibold">
                                {p.value.toLocaleString()} ({p.percent.toFixed(1)}%)
                              </span>
                            </div>
                          );
                        }}
                      />
                    }
                  />
                  <Radar dataKey="value" fill="var(--chart-3)" fillOpacity={0.35} stroke="var(--chart-3)" strokeWidth={2} isAnimationActive animationDuration={850} />
                </RadarChart>
              </ChartContainer>
            </GraphPanel>

            <DonutCard
              title="Marital Status"
              description="Distribution by marital status"
              data={maritalPieData}
            />

            <GraphPanel
              title="Marriage Age Split"
              description="Relative share by age-at-marriage category"
            >
              <ChartContainer config={{ value: { label: "Percent", color: "var(--chart-4)" } }} className="h-[300px] w-full">
                <RadialBarChart
                  data={marriageAgeRadialData.map((d) => ({ ...d, radial: d.percent }))}
                  innerRadius={28}
                  outerRadius={120}
                  barSize={18}
                  startAngle={180}
                  endAngle={0}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(_, __, item) => {
                          const p = item.payload as SliceDatum;
                          return (
                            <div className="flex min-w-[200px] items-center justify-between gap-4">
                              <span>{p.label}</span>
                              <span className="font-semibold">{p.percent.toFixed(1)}%</span>
                            </div>
                          );
                        }}
                      />
                    }
                  />
                  <RadialBar dataKey="radial" cornerRadius={10} background animationDuration={850}>
                    {marriageAgeRadialData.map((d) => (
                      <Cell key={d.label} fill={d.fill} />
                    ))}
                  </RadialBar>
                </RadialBarChart>
              </ChartContainer>
              <div className="grid gap-2 sm:grid-cols-2">
                {marriageAgeRadialData.map((d) => (
                  <div key={d.label} className="rounded-lg bg-accent/20 px-3 py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                      <span className="font-medium">{d.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {d.value.toLocaleString()} participants ({d.percent.toFixed(1)}%)
                    </p>
                  </div>
                ))}
              </div>
            </GraphPanel>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
