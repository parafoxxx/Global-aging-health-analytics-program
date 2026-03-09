import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";

export function Footer() {
  return (
    <footer className="mt-10 border-t bg-background/95">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-8 w-8 rounded-sm object-contain" />
          <div>
            <p className="text-sm font-semibold tracking-tight">GAHASP</p>
            <p className="text-xs text-muted-foreground">Global Aging & Health Analytics</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            Home
          </Link>
          <Link to="/map" className="text-muted-foreground hover:text-foreground">
            Map
          </Link>
          <a
            href="https://gateway.eu/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            Data Source
          </a>
        </nav>
      </div>
      <div className="border-t">
        <div className="mx-auto w-full max-w-6xl px-6 py-3 text-xs text-muted-foreground">
          © {new Date().getFullYear()} GAHASP. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

