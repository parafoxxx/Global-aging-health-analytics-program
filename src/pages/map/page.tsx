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

const MIN_FRAILTY = 0;
const MAX_FRAILTY = 50;

// Interpolate frailty → color (light → dark)
const getFrailtyColor = (frailty?: number) => {
  if (frailty === undefined || frailty === null) return "#D6D6DA";

  const t = Math.min(
    1,
    Math.max(0, (frailty - MIN_FRAILTY) / (MAX_FRAILTY - MIN_FRAILTY))
  );

  // Light teal → dark red
  return `oklch(${0.85 - t * 0.4} ${0.08 + t * 0.18} ${190 - t * 150})`;
};


export default function MapPage() {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const countries = useQuery(api.countries.getAllCountries);
  const navigate = useNavigate();

  const getCountryData = (countryName: string) => {
    return countries?.find((c) => c.country === countryName);
  };

  return (
   <div
  className="min-h-screen bg-cover bg-center bg-no-repeat"
  style={{
    backgroundImage:
      "url('https://images.pexels.com/photos/19670/pexels-photo.jpg')",
  }}
>


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
        <div className="bg-card rounded-xl shadow-2xl border p-6 max-w-5xl mx-auto relative">


          <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
  <div className="text-xs text-muted-foreground font-medium mb-1">
    Frailty %
  </div>

  <div className="relative h-52 w-4 rounded overflow-hidden border">
    {Array.from({ length: 100 }).map((_, i) => {
      const value = MAX_FRAILTY - (i / 99) * (MAX_FRAILTY - MIN_FRAILTY);
      return (
        <div
          key={i}
          data-tooltip-id="scale-tooltip"
          data-tooltip-content={`${value.toFixed(1)}%`}
          style={{
            height: "1%",
            background: getFrailtyColor(value),
          }}
        />
      );
    })}
  </div>

  <div className="text-[10px] text-muted-foreground mt-1">
    Low → High
  </div>
</div>


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
                          fill: getFrailtyColor(countryData?.frail_percentage),

                          stroke: "#FFFFFF",
                          strokeWidth: 0.5,
                          outline: "none",
                        },
                        hover: {
                          fill: countryData
  ? getFrailtyColor(countryData.frail_percentage + 5)
  : "#A0A0A0",

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

      <Tooltip id="scale-tooltip" place="right" />
      <Tooltip id="country-tooltip" />

    </div>
  );
}
