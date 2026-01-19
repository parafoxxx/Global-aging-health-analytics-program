import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export default function MapPage() {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const countries = useQuery(api.countries.getAllCountries);
  const navigate = useNavigate();

  const getCountryData = (countryName: string) => {
    return countries?.find((c) => c.country === countryName);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background">
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center space-y-3 mb-10">
  <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-primary via-chart-1 to-primary bg-clip-text text-transparent">
    Global Frailty Atlas
  </h1>

  <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
    Explore country-wise frailty prevalence. Hover to preview, click to dive deeper.
  </p>
</div>
        
        {/* Map Container */}
        <div className="bg-card rounded-xl shadow-2xl border p-6 max-w-5xl mx-auto">

          <ComposableMap
            projectionConfig={{
              scale: 150,
            }}
            className="w-full"  
            style={{ width: "100%", height: "auto" }}
          >
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const countryName = geo.properties.name;
                  const countryData = getCountryData(countryName);
                  const isHovered = hoveredCountry === countryName;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      data-tooltip-id="country-tooltip"
                      data-tooltip-content={
                        countryData
                          ? `${countryData.country} - Frailty: ${countryData.frail_percentage.toFixed(1)}% | Sample: ${countryData.total_count.toLocaleString()}`
                          : geo.properties.name
                      }
                      onMouseEnter={() => setHoveredCountry(countryName)}
                      onMouseLeave={() => setHoveredCountry(null)}
                      onClick={() => {
                        if (countryData) {
                          navigate(`/country/${encodeURIComponent(countryData.country)}`);
                        }
                      }}
                      style={{
                        default: {
                          fill: countryData ? "oklch(0.6 0.118 184.704)" : "#D6D6DA",
                          stroke: "#FFFFFF",
                          strokeWidth: 0.5,
                          outline: "none",
                        },
                        hover: {
                          fill: countryData ? "oklch(0.646 0.222 41.116)" : "#A0A0A0",
                          stroke: "#FFFFFF",
                          strokeWidth: 1,
                          outline: "none",
                          cursor: countryData ? "pointer" : "default",
                        },
                        pressed: {
                          fill: "oklch(0.398 0.07 227.392)",
                          stroke: "#FFFFFF",
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
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ background: "oklch(0.6 0.118 184.704)" }} />
            <span>Countries with health data</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#D6D6DA] rounded" />
            <span>No data available</span>
          </div>
        </div>

        {/* Stats Summary */}
        {countries && countries.length > 0 && (
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            <div className="bg-card rounded-xl border p-6 text-center">
              <div className="text-4xl font-bold text-primary">{countries.length}</div>
              <p className="text-sm text-muted-foreground mt-2">Countries with Data</p>
            </div>
            <div className="bg-card rounded-xl border p-6 text-center">
              <div className="text-4xl font-bold text-primary">
                {countries.reduce((sum, c) => sum + (c.total_count || 0), 0).toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground mt-2">Total Participants</p>
            </div>
            <div className="bg-card rounded-xl border p-6 text-center">
              <div className="text-4xl font-bold text-primary">
                {(countries.reduce((sum, c) => sum + (c.avg_age || 0), 0) / countries.length).toFixed(1)}
              </div>
              <p className="text-sm text-muted-foreground mt-2">Average Age</p>
            </div>
          </div>
        )}
      </div>

      <Tooltip id="country-tooltip" />
    </div>
  );
}
