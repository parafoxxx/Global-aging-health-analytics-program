import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapIcon, SearchIcon, BookOpenIcon, MenuIcon, XIcon, DatabaseIcon, GlobeIcon, NewspaperIcon, FileTextIcon, ExternalLinkIcon, UsersIcon, TrendingUpIcon, ActivityIcon } from "lucide-react";

const heroImages = [
  "https://images.unsplash.com/photo-1581579438930-a0269719fde7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920",
  "https://images.unsplash.com/photo-1768498950658-87ecfe232b59?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920",
  "https://images.unsplash.com/photo-1765896387377-e293914d1e69?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920",
  "https://images.unsplash.com/photo-1758691736407-02406d18df6c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920"
];

export default function Index() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const databases = [
    {
      name: "LASI",
      fullName: "Longitudinal Aging Study in India",
      description: "A comprehensive longitudinal study of health, economic, and social well-being of India's aging population covering 72,000+ individuals aged 45 and above.",
      region: "India",
      icon: "🇮🇳",
      url: "https://www.iipsindia.ac.in/content/lasi-wave-i",
      participants: "72,000+",
      years: "2017-present"
    },
    {
      name: "SHARE",
      fullName: "Survey of Health, Ageing and Retirement in Europe",
      description: "Multi-disciplinary cross-national panel database covering 27 European countries and Israel, tracking health, socio-economic status, and social networks of 140,000+ individuals aged 50+.",
      region: "Europe",
      icon: "🇪🇺",
      url: "http://www.share-project.org/",
      participants: "140,000+",
      years: "2004-present"
    },
    {
      name: "HRS",
      fullName: "Health and Retirement Study",
      description: "Leading US longitudinal study examining the health, economic circumstances, and well-being of Americans over age 50. Data spans 30+ years with 37,000+ respondents.",
      region: "United States",
      icon: "🇺🇸",
      url: "https://hrs.isr.umich.edu/",
      participants: "37,000+",
      years: "1992-present"
    },
    {
      name: "LHL",
      fullName: "Longitudinal Healthy Longevity Survey",
      description: "International longitudinal study examining determinants of healthy aging, disability, and mortality across diverse populations in Asia, Europe, and Latin America.",
      region: "Global",
      icon: "🌍",
      url: "https://gateway.eu/",
      participants: "50,000+",
      years: "2000-present"
    }
  ];

  const news = [
    {
      title: "Global Aging Population Reaches 1.4 Billion",
      date: "January 15, 2026",
      excerpt: "New WHO report highlights unprecedented demographic shift with implications for healthcare systems worldwide.",
      image: "https://images.unsplash.com/photo-1630845523933-2d2028d56e41?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
      url: "https://www.who.int/news-room/fact-sheets/detail/ageing-and-health",
      source: "WHO"
    },
    {
      title: "Breakthrough in Frailty Prevention Research",
      date: "January 10, 2026",
      excerpt: "International consortium publishes findings on lifestyle interventions that significantly reduce frailty risk in older adults.",
      image: "https://images.unsplash.com/photo-1581579438930-a0269719fde7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
      url: "https://www.nia.nih.gov/news",
      source: "NIA"
    },
    {
      title: "New Cross-National Data Portal Launches",
      date: "December 28, 2025",
      excerpt: "Researchers gain unified access to harmonized aging data from LASI, SHARE, HRS, and other major longitudinal studies.",
      image: "https://images.unsplash.com/photo-1631217868204-db1ed6bdd224?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
      url: "https://gateway.eu/",
      source: "Gateway to Global Aging Data"
    }
  ];

  const journals = [
    { name: "The Lancet Healthy Longevity", url: "https://www.thelancet.com/journals/lanhl" },
    { name: "Journal of Gerontology", url: "https://academic.oup.com/biomedgerontology" },
    { name: "Age and Ageing", url: "https://academic.oup.com/ageing" },
    { name: "Journal of the American Geriatrics Society", url: "https://agsjournals.onlinelibrary.wiley.com/journal/15325415" },
    { name: "BMC Geriatrics", url: "https://bmcgeriatr.biomedcentral.com/" },
    { name: "Aging Cell", url: "https://onlinelibrary.wiley.com/journal/14749726" }
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/map?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/5 to-background">
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-card rounded-lg shadow-lg border"
      >
        {menuOpen ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
      </button>

      {/* Left Sidebar Menu */}
      <aside
        className={`fixed left-0 top-0 h-screen w-72 bg-gradient-to-b from-card to-card/95 border-r shadow-2xl z-40 transition-transform duration-300 overflow-y-auto ${
          menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-6">
          <div className="mb-10 pb-6 border-b">
            <h2 className="text-3xl font-extrabold bg-gradient-to-r from-primary via-chart-1 to-chart-2 bg-clip-text text-transparent mb-2">
              WHAFD
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              World Health and Frailty Database<br />
            </p>
            <Badge variant="secondary" className="mt-3 text-xs">
              <ActivityIcon className="h-3 w-3 mr-1" />
              Live Data
            </Badge>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => navigate("/")}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-semibold rounded-xl bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all"
            >
              <GlobeIcon className="h-5 w-5" />
              Home
            </button>
            <button
              onClick={() => navigate("/map")}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium rounded-xl hover:bg-accent hover:shadow-md transition-all group"
            >
              <MapIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
              Interactive Map
            </button>
            <button
              onClick={() => {
                const element = document.getElementById("databases");
                element?.scrollIntoView({ behavior: "smooth" });
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium rounded-xl hover:bg-accent hover:shadow-md transition-all group"
            >
              <DatabaseIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
              Data Sources
            </button>
            <button
              onClick={() => {
                const element = document.getElementById("news");
                element?.scrollIntoView({ behavior: "smooth" });
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium rounded-xl hover:bg-accent hover:shadow-md transition-all group"
            >
              <NewspaperIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
              Latest News
            </button>
            <button
              onClick={() => {
                const element = document.getElementById("journals");
                element?.scrollIntoView({ behavior: "smooth" });
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium rounded-xl hover:bg-accent hover:shadow-md transition-all group"
            >
              <BookOpenIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
              Research Journals
            </button>
          </nav>

          <div className="mt-10 p-5 bg-gradient-to-br from-accent to-accent/70 rounded-xl border shadow-inner">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-xs font-semibold text-foreground">System Status</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Version 3.0 • Updated January 2026
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              33 Countries • 37,772 Participants
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 min-h-screen">
        {/* Hero Section with Image Slider */}
        <section className="relative overflow-hidden min-h-[85vh] flex items-center">
          {/* Background Image Slider */}
          <div className="absolute inset-0">
            {heroImages.map((image, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-1000 ${
                  index === currentSlide ? "opacity-100" : "opacity-0"
                }`}
              >
                <img
                  src={image}
                  alt={`Health research ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/85 to-background/75 backdrop-blur-sm" />
              </div>
            ))}
          </div>

          {/* Slide Indicators */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-2">
            {heroImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide ? "w-8 bg-primary" : "w-2 bg-muted-foreground/40"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          {/* Hero Content */}
          <div className="container relative mx-auto px-6 py-24 lg:py-36 z-10">
            <div className="max-w-5xl mx-auto text-center space-y-8">
              <Badge variant="secondary" className="text-sm px-4 py-2 font-medium shadow-lg">
                <TrendingUpIcon className="h-4 w-4 mr-2" />
                Live Global Health Data Platform
              </Badge>
              
              <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-tight font-serif">
                World Health and Frailty Database
              </h1>
              
              <p className="text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-sans">
                Access comprehensive aging and health data from four major longitudinal studies spanning 
                <span className="font-semibold text-foreground"> 33 countries</span> with 
                <span className="font-semibold text-foreground"> 37,000+ participants</span>
              </p>

              {/* Search Bar */}
              <form onSubmit={handleSearch} className="max-w-2xl mx-auto mt-10">
                <div className="flex gap-3">
                  <Input
                    type="text"
                    placeholder="Search countries, health metrics, or research topics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 h-14 text-base px-5 shadow-lg border-2 focus:border-primary bg-card"
                  />
                  <Button type="submit" size="lg" className="h-14 px-8 shadow-xl hover:shadow-2xl transition-all font-semibold">
                    <SearchIcon className="h-5 w-5 mr-2" />
                    Search
                  </Button>
                </div>
              </form>

              {/* CTA Button */}
              <div className="pt-6">
                <Button
                  size="lg"
                  onClick={() => navigate("/map")}
                  className="h-14 px-12 text-base font-semibold shadow-2xl hover:shadow-[0_20px_60px_-15px] hover:scale-105 transition-all duration-300"
                >
                  <MapIcon className="h-5 w-5 mr-2" />
                  Explore Interactive World Map
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Databases Section */}
        <section id="databases" className="py-20 px-6 bg-accent/30">
          <div className="container mx-auto max-w-7xl">
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4 text-sm px-4 py-2 font-medium">
                <DatabaseIcon className="h-4 w-4 mr-2" />
                Four Major Studies
              </Badge>
              <h2 className="text-4xl lg:text-5xl font-bold mb-5 font-serif text-foreground">
                Integrated Data Sources
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Our platform harmonizes data from four internationally recognized longitudinal aging studies, 
                providing unparalleled insights into global health trends
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {databases.map((db) => (
                <a
                  key={db.name}
                  href={db.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <Card className="h-full hover:shadow-xl hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 bg-card">
                    <CardHeader className="pb-4">
                      <div className="flex items-start gap-5">
                        <div className="text-5xl group-hover:scale-110 transition-transform duration-300">
                          {db.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <CardTitle className="text-2xl font-bold font-serif">{db.name}</CardTitle>
                            <ExternalLinkIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                          <CardDescription className="text-sm font-medium text-primary">
                            {db.fullName}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-muted-foreground leading-relaxed text-sm">{db.description}</p>
                      
                      <div className="flex flex-wrap gap-3 pt-2">
                        <Badge variant="secondary" className="gap-1.5">
                          <GlobeIcon className="h-3.5 w-3.5" />
                          {db.region}
                        </Badge>
                        <Badge variant="secondary" className="gap-1.5">
                          <UsersIcon className="h-3.5 w-3.5" />
                          {db.participants}
                        </Badge>
                        <Badge variant="secondary" className="gap-1.5">
                          <ActivityIcon className="h-3.5 w-3.5" />
                          {db.years}
                        </Badge>
                      </div>

                      <div className="pt-3 flex items-center text-sm text-primary font-medium group-hover:gap-2 gap-1 transition-all">
                        <span>Visit Official Website</span>
                        <ExternalLinkIcon className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* News Section */}
        <section id="news" className="py-20 px-6 bg-background">
          <div className="container mx-auto max-w-7xl">
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4 text-sm px-4 py-2 font-medium">
                <NewspaperIcon className="h-4 w-4 mr-2" />
                Research Updates
              </Badge>
              <h2 className="text-4xl lg:text-5xl font-bold mb-5 font-serif text-foreground">
                Latest News & Insights
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Stay informed about the latest developments in aging and health research worldwide
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {news.map((item, index) => (
                <a
                  key={index}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 pt-0 h-full flex flex-col bg-card">
                    <div className="relative overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-background/90 backdrop-blur-sm text-xs">
                          {item.source}
                        </Badge>
                      </div>
                    </div>
                    <CardHeader className="flex-1">
                      <CardDescription className="text-xs font-medium text-primary uppercase tracking-wide">
                        {item.date}
                      </CardDescription>
                      <CardTitle className="text-lg font-bold leading-tight group-hover:text-primary transition-colors">
                        {item.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-5">
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                        {item.excerpt}
                      </p>
                      <div className="flex items-center text-sm text-primary font-medium group-hover:gap-2 gap-1 transition-all">
                        <span>Read Article</span>
                        <ExternalLinkIcon className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Journals & References */}
        <section id="journals" className="py-20 px-6 bg-accent/30">
          <div className="container mx-auto max-w-7xl">
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4 text-sm px-4 py-2 font-medium">
                <BookOpenIcon className="h-4 w-4 mr-2" />
                Academic Resources
              </Badge>
              <h2 className="text-4xl lg:text-5xl font-bold mb-5 font-serif text-foreground">
                Research Journals & References
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Leading peer-reviewed publications in gerontology, aging research, and geriatric medicine
              </p>
            </div>

            <Card className="shadow-xl border bg-card">
              <CardContent className="p-8">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {journals.map((journal, index) => (
                    <a
                      key={index}
                      href={journal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent hover:border-primary hover:shadow-md transition-all group"
                    >
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <FileTextIcon className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold leading-tight block group-hover:text-primary transition-colors">
                          {journal.name}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                          <ExternalLinkIcon className="h-3 w-3" />
                          <span>Visit Journal</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="mt-8 text-center">
              <Card className="inline-block bg-muted/50 border-0">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground max-w-2xl">
                    <strong className="text-foreground">Research Note:</strong> These journals publish cutting-edge research on aging, 
                    frailty, longevity, and geriatric health. Click any journal to access their latest publications.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 border-t bg-background">
          <div className="container mx-auto max-w-7xl">
            <div className="text-center space-y-5">
              <div className="flex items-center justify-center gap-3 mb-5">
                <div className="h-11 w-11 rounded-lg bg-primary flex items-center justify-center">
                  <GlobeIcon className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-bold font-serif text-foreground">
                    GAHASP
                  </h3>
                  <p className="text-xs text-muted-foreground">Global Health Analytics</p>
                </div>
              </div>
              
              <div className="flex flex-wrap justify-center gap-5 text-sm text-muted-foreground">
                <a href="#databases" className="hover:text-primary transition-colors font-medium">Data Sources</a>
                <span>•</span>
                <a href="#news" className="hover:text-primary transition-colors font-medium">Latest News</a>
                <span>•</span>
                <a href="#journals" className="hover:text-primary transition-colors font-medium">Research Journals</a>
              </div>

              <div className="pt-5 border-t">
                <p className="text-sm text-muted-foreground">
                  © {new Date().getFullYear()} Global Aging & Health Analytics Platform. All rights reserved.
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Data harmonized from LASI, SHARE, HRS, and LHL longitudinal studies
                </p>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
