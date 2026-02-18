import { useNavigate } from "react-router-dom";
import { CompassIcon, HomeIcon, MapIcon } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,color-mix(in_oklch,var(--primary)_20%,transparent),transparent_38%),radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--chart-3)_18%,transparent),transparent_36%),linear-gradient(to_bottom_right,var(--background),color-mix(in_oklch,var(--accent)_35%,var(--background)))]" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="rounded-3xl border bg-card/85 px-8 py-10 shadow-2xl backdrop-blur-md"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Error 404
          </p>
          <h1 className="mt-3 text-4xl font-serif font-bold tracking-tight md:text-5xl">
            Page not found
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground md:text-base">
            The page you requested does not exist or has been moved.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => navigate("/")}>
              <HomeIcon className="mr-2 size-4" />
              Back to Home
            </Button>
            <Button variant="outline" onClick={() => navigate("/map")}>
              <MapIcon className="mr-2 size-4" />
              Open Map
            </Button>
          </div>
        </motion.div>
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <CompassIcon className="size-4" />
          Check the URL and try again.
        </div>
      </main>
    </div>
  );
}
