import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CalculatorIcon,
  CheckCircle2Icon,
  RefreshCcwIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type FrailtyOption = {
  label: string;
  score: number;
};

type FrailtyItem = {
  id: string;
  domain: string;
  prompt: string;
  options: FrailtyOption[];
};

const ASSISTANCE_OPTIONS: FrailtyOption[] = [
  { label: "No assistance", score: 0 },
  { label: "Some assistance", score: 0.5 },
  { label: "Needs assistance", score: 1 },
];

const YES_NO_OPTIONS: FrailtyOption[] = [
  { label: "No", score: 0 },
  { label: "Yes", score: 1 },
];

const ITEMS: FrailtyItem[] = [
  { id: "D1", domain: "Disability", prompt: "Do you need assistance with bathing?", options: ASSISTANCE_OPTIONS },
  { id: "D2", domain: "Disability", prompt: "Do you need assistance with dressing?", options: ASSISTANCE_OPTIONS },
  { id: "D3", domain: "Disability", prompt: "Do you need assistance with eating?", options: ASSISTANCE_OPTIONS },
  {
    id: "D4",
    domain: "Disability",
    prompt: "Do you need assistance with moving indoors (transferring)?",
    options: ASSISTANCE_OPTIONS,
  },
  { id: "D5", domain: "Disability", prompt: "Do you need assistance with toilet use?", options: ASSISTANCE_OPTIONS },
  {
    id: "D6",
    domain: "Disability",
    prompt: "Do you need assistance due to urine/bowel continence issues?",
    options: ASSISTANCE_OPTIONS,
  },
  { id: "D7", domain: "Disability", prompt: "Do you need assistance preparing meals?", options: ASSISTANCE_OPTIONS },
  { id: "D8", domain: "Disability", prompt: "Do you need assistance doing housework?", options: ASSISTANCE_OPTIONS },
  { id: "D9", domain: "Disability", prompt: "Do you need assistance taking a bus?", options: ASSISTANCE_OPTIONS },
  {
    id: "D10",
    domain: "Disability",
    prompt: "Do you need assistance shopping for essentials?",
    options: ASSISTANCE_OPTIONS,
  },
  { id: "D11", domain: "Disability", prompt: "Do you need assistance managing money?", options: ASSISTANCE_OPTIONS },
  { id: "D12", domain: "Disability", prompt: "Do you need assistance washing clothes?", options: ASSISTANCE_OPTIONS },
  { id: "D13", domain: "Disability", prompt: "Do you need assistance taking medications?", options: ASSISTANCE_OPTIONS },
  { id: "D14", domain: "Disability", prompt: "Do you need assistance using the telephone?", options: ASSISTANCE_OPTIONS },
  { id: "S1", domain: "Signs and Function", prompt: "Do you have vision impairment?", options: YES_NO_OPTIONS },
  { id: "S2", domain: "Signs and Function", prompt: "Do you have hearing impairment?", options: YES_NO_OPTIONS },
  {
    id: "S3",
    domain: "Signs and Function",
    prompt: "Is your gait speed slow (>10 seconds)?",
    options: [
      { label: "<=10 seconds", score: 0 },
      { label: ">10 seconds", score: 1 },
    ],
  },
  { id: "C1", domain: "Comorbidities", prompt: "Do you have a history of stroke?", options: YES_NO_OPTIONS },
  { id: "C2", domain: "Comorbidities", prompt: "Do you have heart disease?", options: YES_NO_OPTIONS },
  { id: "C3", domain: "Comorbidities", prompt: "Do you have chronic lung disease?", options: YES_NO_OPTIONS },
  { id: "C4", domain: "Comorbidities", prompt: "Do you have cancer?", options: YES_NO_OPTIONS },
  { id: "C5", domain: "Comorbidities", prompt: "Do you have hypertension?", options: YES_NO_OPTIONS },
  { id: "C6", domain: "Comorbidities", prompt: "Do you have diabetes?", options: YES_NO_OPTIONS },
  { id: "C7", domain: "Comorbidities", prompt: "Do you have eye disease?", options: YES_NO_OPTIONS },
  { id: "C8", domain: "Comorbidities", prompt: "Do you have rheumatoid arthritis?", options: YES_NO_OPTIONS },
  { id: "M1", domain: "Signs and Symptoms", prompt: "Did you have a fall in the last year?", options: YES_NO_OPTIONS },
  {
    id: "M2",
    domain: "Signs and Symptoms",
    prompt: "Have you had unintentional weight loss recently?",
    options: YES_NO_OPTIONS,
  },
  {
    id: "M3",
    domain: "Signs and Symptoms",
    prompt: "Do you feel exhausted frequently?",
    options: YES_NO_OPTIONS,
  },
  {
    id: "M4",
    domain: "Signs and Symptoms",
    prompt: "How would you rate your quality of sleep?",
    options: [
      { label: "Excellent", score: 0 },
      { label: "Good", score: 0.33 },
      { label: "Fair", score: 0.67 },
      { label: "Poor", score: 1 },
    ],
  },
  { id: "M5", domain: "Signs and Symptoms", prompt: "Do you have ongoing bodily pain?", options: YES_NO_OPTIONS },
  {
    id: "M6",
    domain: "Signs and Symptoms",
    prompt: "How would you rate your overall health?",
    options: [
      { label: "Quite healthy", score: 0 },
      { label: "Healthy", score: 0.25 },
      { label: "Average", score: 0.5 },
      { label: "Unhealthy", score: 0.75 },
      { label: "Quite unhealthy", score: 1 },
    ],
  },
  {
    id: "M7",
    domain: "Signs and Symptoms",
    prompt: "Compared to last year, how has your health changed?",
    options: [
      { label: "Better", score: 0 },
      { label: "Same", score: 0.5 },
      { label: "Worse", score: 1 },
    ],
  },
  {
    id: "P1",
    domain: "Cognitive/Psychological",
    prompt: "Do you have cognitive or psychological difficulties?",
    options: YES_NO_OPTIONS,
  },
];

function classifyFi(fi: number) {
  if (fi >= 0.25) {
    return {
      label: "Frail",
      detail: "FI score is 0.25 or higher.",
      tone: "destructive" as const,
    };
  }
  return {
    label: "Non-frail",
    detail: "FI score is below 0.25.",
    tone: "secondary" as const,
  };
}

export default function FrailtyTestPage() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Array<number | null>>(Array.from({ length: ITEMS.length }, () => null));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const currentItem = ITEMS[currentIndex];
  const currentAnswer = answers[currentIndex];
  const answeredCount = useMemo(() => answers.filter((x) => x !== null).length, [answers]);
  const progressValue = (answeredCount / ITEMS.length) * 100;
  const completionPercent = Math.round(progressValue);

  const deficitSum = useMemo(() => answers.reduce<number>((sum, value) => sum + (value ?? 0), 0), [answers]);
  const fiScore = deficitSum / ITEMS.length;
  const scorePercent = Math.min(100, (fiScore / 0.5) * 100);
  const result = classifyFi(fiScore);

  const setAnswer = (index: number, value: string) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = numeric;
      return next;
    });
    setShowResult(false);
  };

  const resetTest = () => {
    setAnswers(Array.from({ length: ITEMS.length }, () => null));
    setCurrentIndex(0);
    setShowResult(false);
  };

  const goNext = () => setCurrentIndex((prev) => Math.min(prev + 1, ITEMS.length - 1));
  const goPrev = () => setCurrentIndex((prev) => Math.max(prev - 1, 0));
  const finishTest = () => {
    if (answeredCount < ITEMS.length) return;
    setShowResult(true);
  };

  if (showResult && answeredCount === ITEMS.length) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_36%),linear-gradient(to_bottom,var(--background),color-mix(in_oklch,var(--accent)_24%,var(--background)))] px-4 py-8">
        <motion.div
          className="mx-auto max-w-5xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-11 w-11 rounded-md object-contain" />
              <div>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Frailty Index Test</h1>
                <p className="text-sm text-muted-foreground">Rockwood cumulative deficit model</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowResult(false)}>
                Review Answers
              </Button>
              <Button variant="outline" onClick={() => navigate("/")}>
                <ArrowLeftIcon className="mr-2 size-4" />
                Home
              </Button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-2xl">Your Frailty Result</CardTitle>
                <CardDescription>FI = Deficit sum / {ITEMS.length} assessed variables</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-xl border bg-card/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Frailty Index (FI)</p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-5xl font-semibold leading-none">{fiScore.toFixed(3)}</span>
                    <span className="pb-1 text-sm text-muted-foreground">/ 1.000</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Deficit sum: {deficitSum.toFixed(2)} / {ITEMS.length}
                  </p>
                  <div className="mt-4">
                    <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-full bg-gradient-to-r from-emerald-500/80 via-amber-500/80 to-red-500/80" />
                      <div
                        className="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow"
                        style={{ left: `calc(${scorePercent}% - 8px)` }}
                        aria-hidden
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                      <span>Lower</span>
                      <span>Cutoff 0.25</span>
                      <span>Higher</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border bg-accent/20 p-4">
                  <Badge variant={result.tone}>{result.label}</Badge>
                  <p className="text-sm text-muted-foreground">{result.detail}</p>
                  <p className="rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
                    Classification used: FI &lt; 0.25 = non-frail, FI &gt;= 0.25 = frail.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Recommended Next Step</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fiScore >= 0.25 ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <AlertTriangleIcon className="size-4 text-amber-600" />
                        Consider clinical frailty assessment
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        A clinician can evaluate deficits in context and guide interventions.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <CheckCircle2Icon className="size-4 text-emerald-600" />
                        Continue routine monitoring
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Maintain activity, nutrition, and periodic reassessment.
                      </p>
                    </div>
                  )}
                  <Button className="w-full" variant="outline" onClick={resetTest}>
                    <RefreshCcwIcon className="mr-2 size-4" />
                    Retake Test
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Scoring Guide</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <p>FI is continuous from 0 to 1.</p>
                  <p>Each variable contributes 0 to 1 deficit points.</p>
                  <p>Cutoff used in this test: 0.25.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_36%),linear-gradient(to_bottom,var(--background),color-mix(in_oklch,var(--accent)_24%,var(--background)))] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-11 w-11 rounded-md object-contain" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Frailty Index Test</h1>
              <p className="text-sm text-muted-foreground">Rockwood 33-deficit style screening flow</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeftIcon className="mr-2 size-4" />
            Home
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalculatorIcon className="size-4 text-muted-foreground" />
                Answer one variable at a time
              </CardTitle>
              <CardDescription>Choose the option that best matches your current status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentItem.id}
                  className="rounded-xl border bg-card/70 p-5"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.26 }}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Badge variant="outline">
                      Item {currentIndex + 1} / {ITEMS.length}
                    </Badge>
                    <Badge variant="secondary">{currentItem.domain}</Badge>
                  </div>
                  <p className="mb-4 text-lg font-medium">{currentItem.prompt}</p>
                  <RadioGroup
                    value={currentAnswer === null ? undefined : String(currentAnswer)}
                    onValueChange={(value) => setAnswer(currentIndex, value)}
                    className="grid gap-2"
                  >
                    {currentItem.options.map((option, optionIndex) => {
                      const controlId = `${currentItem.id}-${option.label}-${option.score}`;
                      const isSelected = currentAnswer === option.score;
                      return (
                        <motion.div
                          key={controlId}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18, delay: 0.04 * optionIndex }}
                        >
                          <Label
                            htmlFor={controlId}
                            className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                                : "hover:border-primary/40"
                            }`}
                          >
                            <span className="text-sm font-medium">{option.label}</span>
                            <div className="flex items-center gap-3">
                              <RadioGroupItem id={controlId} value={String(option.score)} />
                            </div>
                          </Label>
                        </motion.div>
                      );
                    })}
                  </RadioGroup>
                </motion.div>
              </AnimatePresence>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="outline" onClick={goPrev} disabled={currentIndex === 0}>
                  <ArrowLeftIcon className="mr-2 size-4" />
                  Previous
                </Button>
                {currentIndex < ITEMS.length - 1 ? (
                  <Button onClick={goNext} disabled={currentAnswer === null}>
                    Next
                    <ArrowRightIcon className="ml-2 size-4" />
                  </Button>
                ) : (
                  <Button onClick={finishTest} disabled={answeredCount < ITEMS.length}>
                    Finish & Calculate FI
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Progress</CardTitle>
                <CardDescription>
                  {answeredCount} of {ITEMS.length} answered
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={progressValue} />
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Cutoff: 0.25</Badge>
                </div>
                <div className="rounded-lg border bg-accent/20 p-3 text-xs text-muted-foreground">
                  Completion: {completionPercent}%{currentAnswer !== null ? " • current answer saved" : ""}
                </div>
                <Button className="w-full" variant="outline" onClick={resetTest}>
                  <RefreshCcwIcon className="mr-2 size-4" />
                  Reset
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
