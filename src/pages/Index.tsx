import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ActivityIcon,
  ArrowRightIcon,
  BookOpenIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LoaderCircleIcon,
  MapIcon,
  MicIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCountriesData } from "@/lib/countries-data";
import { BrandLogo } from "@/components/BrandLogo";

const datasets = [
  {
    name: "LASI",
    fullName: "Longitudinal Aging Study in India",
    description: "Aging and health trends for adults 45+ in India.",
    region: "India",
    url: "https://www.iipsindia.ac.in/content/lasi-wave-i",
  },
  {
    name: "SHARE",
    fullName: "Survey of Health, Ageing and Retirement in Europe",
    description: "Cross-country European panel on aging, health, and retirement.",
    region: "Europe",
    url: "http://www.share-project.org/",
  },
  {
    name: "HRS",
    fullName: "Health and Retirement Study",
    description: "Long-running US study on aging outcomes, health, and finances.",
    region: "United States",
    url: "https://hrs.isr.umich.edu/",
  },
  {
    name: "Gateway",
    fullName: "Gateway to Global Aging Data",
    description: "Harmonized cross-national data infrastructure for aging research.",
    region: "Global",
    url: "https://gateway.eu/",
  },
];

const journals = [
  { name: "The Lancet Healthy Longevity", url: "https://www.thelancet.com/journals/lanhl" },
  { name: "Age and Ageing", url: "https://academic.oup.com/ageing" },
  { name: "Journal of Gerontology", url: "https://academic.oup.com/biomedgerontology" },
  { name: "BMC Geriatrics", url: "https://bmcgeriatr.biomedcentral.com/" },
  { name: "Journal of the American Geriatrics Society", url: "https://agsjournals.onlinelibrary.wiley.com/journal/15325415" },
  { name: "Aging Cell", url: "https://onlinelibrary.wiley.com/journal/14749726" },
];

type LiveNewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
};

const FALLBACK_NEWS: LiveNewsItem[] = [
  {
    title: "WHO: Ageing and Health",
    link: "https://www.who.int/news-room/fact-sheets/detail/ageing-and-health",
    source: "World Health Organization",
    publishedAt: "",
  },
  {
    title: "NIA Research News",
    link: "https://www.nia.nih.gov/news",
    source: "National Institute on Aging",
    publishedAt: "",
  },
  {
    title: "Gateway to Global Aging Data Updates",
    link: "https://gateway.eu/",
    source: "Gateway to Global Aging Data",
    publishedAt: "",
  },
];

const NEWS_CACHE_KEY = "gahasp_latest_news";

function toTime(value: string) {
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function normalizeNews(items: LiveNewsItem[]) {
  const unique = new Map<string, LiveNewsItem>();
  for (const item of items) {
    if (!item?.title || !item?.link) continue;
    if (!unique.has(item.link)) unique.set(item.link, item);
  }
  return Array.from(unique.values()).sort((a, b) => toTime(b.publishedAt) - toTime(a.publishedAt));
}

function readCachedNews() {
  try {
    const raw = window.localStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LiveNewsItem[];
    return Array.isArray(parsed) ? normalizeNews(parsed) : [];
  } catch {
    return [];
  }
}

function writeCachedNews(items: LiveNewsItem[]) {
  try {
    window.localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage failures
  }
}

function ensureThreeNews(primary: LiveNewsItem[], secondary: LiveNewsItem[] = []) {
  const merged = normalizeNews([...primary, ...secondary, ...FALLBACK_NEWS]);
  return merged.slice(0, 3);
}

export default function Index() {
  const navigate = useNavigate();
  const countriesQuery = useCountriesData();
  const countries = countriesQuery.data;
  const [searchQuery, setSearchQuery] = useState("");
  const [news, setNews] = useState<LiveNewsItem[]>(() => FALLBACK_NEWS);
  const [isNewsLoading, setIsNewsLoading] = useState(false);

  const summary = useMemo(() => {
    if (!countries || countries.length === 0) {
      return { countriesCount: 0, participants: 0, avgFrailty: 0 };
    }
    const participants = countries.reduce((sum, item) => sum + item.total_count, 0);
    const avgFrailty = countries.reduce((sum, item) => sum + item.frail_percentage, 0) / countries.length;
    return {
      countriesCount: countries.length,
      participants,
      avgFrailty,
    };
  }, [countries]);

  const topFrailtyCountries = useMemo(() => {
    if (!countries) return [];
    return [...countries].sort((a, b) => b.frail_percentage - a.frail_percentage).slice(0, 4);
  }, [countries]);

  const suggestions = useMemo(() => {
    if (!countries || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return countries.filter((item) => item.country.toLowerCase().includes(q)).slice(0, 6);
  }, [countries, searchQuery]);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    const exact = countries?.find((item) => item.country.toLowerCase() === query.toLowerCase());
    if (exact) {
      navigate(`/country/${encodeURIComponent(exact.country)}`);
      return;
    }
    navigate(`/map?search=${encodeURIComponent(query)}`);
  };

  useEffect(() => {
    const fixed = ensureThreeNews(readCachedNews());
    setNews(fixed);
    writeCachedNews(fixed);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-3 text-left">
            <BrandLogo className="h-10 w-10 rounded-md object-contain" />
            <span>
              <p className="text-lg font-semibold tracking-tight">GAHASP</p>
              <p className="text-xs text-muted-foreground">Global Aging & Health Analytics</p>
            </span>
          </button>
          <nav className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" onClick={() => scrollTo("datasets")}>Data Sources</Button>
            <Button variant="ghost" onClick={() => scrollTo("insights")}>Insights</Button>
            <Button variant="ghost" onClick={() => scrollTo("journals")}>Journals</Button>
            <Button variant="outline" onClick={() => navigate("/survey")}>
              <MicIcon className="mr-2 size-4" />
              Voice Survey
            </Button>
            <Button onClick={() => navigate("/map")}>
              <MapIcon className="mr-2 size-4" />
              Open Map
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b bg-[linear-gradient(180deg,color-mix(in_oklch,var(--accent)_35%,var(--background)),var(--background))]">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Badge variant="secondary" className="mb-4">Live Cross-National Platform</Badge>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                Professional analytics for global aging and frailty data
              </h1>
              <p className="mt-4 max-w-xl text-muted-foreground">
                Explore harmonized country-level indicators from major longitudinal studies and move from raw data to actionable insights faster.
              </p>

              <form onSubmit={handleSearch} className="mt-8 rounded-2xl border bg-card p-3 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="pl-10"
                      placeholder="Search by country name"
                    />
                  </div>
                  <Button type="submit">
                    Search
                    <ArrowRightIcon className="ml-2 size-4" />
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate("/survey")}>
                    <MicIcon className="mr-2 size-4" />
                    Voice Survey
                  </Button>
                </div>
                {suggestions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suggestions.map((country) => (
                      <button
                        key={country.country}
                        type="button"
                        onClick={() => navigate(`/country/${encodeURIComponent(country.country)}`)}
                        className="rounded-full border px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary"
                      >
                        {country.country}
                      </button>
                    ))}
                  </div>
                )}
              </form>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="rounded-2xl border bg-card p-3 shadow-sm"
            >
              <img
                src="https://images.unsplash.com/photo-1631217868204-db1ed6bdd224?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1400"
                alt="Global health analytics visualization"
                className="h-[320px] w-full rounded-xl object-cover"
              />
            </motion.div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-4 px-6 py-10 md:grid-cols-3">
          {[
            { label: "Countries", value: summary.countriesCount.toLocaleString(), icon: GlobeIcon },
            { label: "Participants", value: summary.participants.toLocaleString(), icon: UsersIcon },
            { label: "Avg Frailty", value: `${summary.avgFrailty.toFixed(1)}%`, icon: ActivityIcon },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{item.value}</p>
                </div>
                <div className="rounded-xl bg-primary/10 p-3 text-primary">
                  <item.icon className="size-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section id="datasets" className="border-y bg-accent/25">
          <div className="mx-auto w-full max-w-6xl px-6 py-16">
            <div className="mb-8">
              <h2 className="text-3xl font-semibold tracking-tight">Integrated Data Sources</h2>
              <p className="mt-2 text-muted-foreground">Foundational studies used for country-level analysis.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {datasets.map((dataset) => (
                <a key={dataset.name} href={dataset.url} target="_blank" rel="noopener noreferrer">
                  <Card className="h-full transition-colors hover:border-primary/40">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-xl">
                        {dataset.name}
                        <ExternalLinkIcon className="size-4 text-muted-foreground" />
                      </CardTitle>
                      <CardDescription>{dataset.fullName}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{dataset.description}</p>
                      <Badge variant="secondary" className="mt-3">{dataset.region}</Badge>
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="insights" className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DatabaseIcon className="size-4 text-muted-foreground" />
                  Latest Aging News
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isNewsLoading && (
                  <div className="flex items-center gap-2 rounded-xl border p-3 text-sm text-muted-foreground">
                    <LoaderCircleIcon className="size-4 animate-spin" />
                    Fetching latest news...
                  </div>
                )}
                {news.map((item) => (
                  <a
                    key={`${item.link}-${item.publishedAt}`}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border p-3 hover:border-primary/40"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.source}
                        {item.publishedAt ? ` • ${new Date(item.publishedAt).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <ExternalLinkIcon className="size-4 text-muted-foreground" />
                  </a>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ActivityIcon className="size-4 text-muted-foreground" />
                  Highest Frailty Rates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topFrailtyCountries.map((country, index) => (
                  <button
                    key={country.country}
                    onClick={() => navigate(`/country/${encodeURIComponent(country.country)}`)}
                    className="flex w-full items-center justify-between rounded-xl border p-3 text-left hover:border-primary/40"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {index + 1}. {country.country}
                      </p>
                      <p className="text-xs text-muted-foreground">{country.total_count.toLocaleString()} participants</p>
                    </div>
                    <p className="text-sm font-semibold text-primary">{country.frail_percentage.toFixed(1)}%</p>
                  </button>
                ))}
                {topFrailtyCountries.length === 0 && (
                  <p className="text-sm text-muted-foreground">No countries available yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="journals" className="border-t bg-accent/25">
          <div className="mx-auto w-full max-w-6xl px-6 py-16">
            <div className="mb-8">
              <h2 className="text-3xl font-semibold tracking-tight">Research Journals</h2>
              <p className="mt-2 text-muted-foreground">Peer-reviewed references for deeper evidence review.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {journals.map((journal) => (
                <a
                  key={journal.name}
                  href={journal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border bg-card p-4 text-sm font-medium hover:border-primary/40"
                >
                  <span className="inline-flex items-center gap-2">
                    <BookOpenIcon className="size-4 text-muted-foreground" />
                    {journal.name}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
