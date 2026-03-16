import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  RefreshCcwIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

type CesdItem = {
  id: number;
  text: string;
  positiveSymptom?: boolean;
};

type Option = {
  value: number;
  label: string;
  hint: string;
};

const OPTIONS: Option[] = [
  { value: 0, label: "Rarely or never", hint: "Less than 1 day" },
  { value: 1, label: "Sometimes", hint: "1-2 days" },
  { value: 2, label: "Often", hint: "3-4 days" },
  { value: 3, label: "Most or all of the time", hint: "5-7 days" },
];

const ITEMS: CesdItem[] = [
  { id: 1, text: "I found it hard to stay focused for long." },
  { id: 2, text: "I felt depressed or emotionally low." },
  { id: 3, text: "My energy felt low and I got tired easily." },
  { id: 4, text: "I felt afraid that something bad might happen." },
  { id: 5, text: "Overall, I felt satisfied with life.", positiveSymptom: true },
  { id: 6, text: "I felt isolated or alone." },
  { id: 7, text: "Small issues upset me more than usual." },
  { id: 8, text: "Even routine tasks felt like too much effort." },
  { id: 9, text: "I felt hopeful about what is ahead.", positiveSymptom: true },
  { id: 10, text: "I generally felt happy.", positiveSymptom: true },
];

function scoreInterpretation(score: number) {
  if (score >= 7) {
    return {
      label: "High depressive symptom range",
      detail: "This score is high on the 10-point screen and warrants follow-up with a mental health professional.",
      tone: "destructive" as const,
    };
  }
  if (score >= 4) {
    return {
      label: "Elevated depressive symptom range",
      detail: "This is above the common cutoff (4+) used in this 10-item screen.",
      tone: "secondary" as const,
    };
  }
  return {
    label: "Lower depressive symptom range",
    detail: "This score is below the usual screening cutoff used for this 10-item form.",
    tone: "outline" as const,
  };
}

export default function DepressionTestPage() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Array<number | null>>(Array.from({ length: ITEMS.length }, () => null));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const currentQuestion = ITEMS[currentIndex];
  const currentAnswer = answers[currentIndex];

  const answeredCount = useMemo(() => answers.filter((value) => value !== null).length, [answers]);
  const progressValue = (answeredCount / ITEMS.length) * 100;

  const questionScore = (item: CesdItem, selected: number | null) => {
    if (selected === null) return 0;
    const frequent = selected >= 2;
    if (item.positiveSymptom) {
      return frequent ? 0 : 1;
    }
    return frequent ? 1 : 0;
  };

  const totalScore = useMemo(
    () => ITEMS.reduce((sum, item, index) => sum + questionScore(item, answers[index]), 0),
    [answers],
  );

  const result = scoreInterpretation(totalScore);

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

  const goNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, ITEMS.length - 1));
  };

  const goPrev = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const finishAssessment = () => {
    if (answeredCount < ITEMS.length) return;
    setShowResult(true);
  };

  const scorePercent = (totalScore / 10) * 100;
  const riskTrackClass =
    totalScore >= 7
      ? "from-amber-500/80 via-orange-500/80 to-red-500/80"
      : totalScore >= 4
        ? "from-blue-500/80 via-indigo-500/80 to-violet-500/80"
        : "from-emerald-500/80 via-teal-500/80 to-cyan-500/80";

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
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Depression Self-Check</h1>
                <p className="text-sm text-muted-foreground">Assessment Result</p>
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
                <CardTitle className="text-2xl">Your Result</CardTitle>
                <CardDescription>10-item depression symptom screen</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-xl border bg-card/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Score</p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-5xl font-semibold leading-none">{totalScore}</span>
                    <span className="pb-1 text-sm text-muted-foreground">/ 10</span>
                  </div>
                  <div className="mt-4">
                    <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full w-full bg-gradient-to-r ${riskTrackClass}`} />
                      <div
                        className="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow"
                        style={{ left: `calc(${Math.min(scorePercent, 100)}% - 8px)` }}
                        aria-hidden
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                      <span>Lower (0-3)</span>
                      <span>Elevated (4-6)</span>
                      <span>High (7-10)</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border bg-accent/20 p-4">
                  <Badge variant={result.tone}>{result.label}</Badge>
                  <p className="text-sm text-muted-foreground">{result.detail}</p>
                  <p className="rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
                    Screening note: This tool does not provide a diagnosis. In this 10-item method, scores of 4 or
                    more are commonly used as a threshold for possible depressive symptoms.
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
                  {totalScore >= 4 ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <AlertTriangleIcon className="size-4 text-amber-600" />
                        Consider speaking with a clinician
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        A qualified professional can assess symptoms in context and discuss support options.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <CheckCircle2Icon className="size-4 text-emerald-600" />
                        Continue routine self-care monitoring
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        If symptoms increase or persist, re-screen and seek professional advice.
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
                  <p>0-3: Lower symptom range</p>
                  <p>4-6: Elevated symptom range</p>
                  <p>7-10: High symptom range</p>
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
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Depression Self-Check</h1>
              <p className="text-sm text-muted-foreground">CES-D short form style questionnaire (10 items)</p>
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
                <ClipboardListIcon className="size-4 text-muted-foreground" />
                During the past week, how often was this true for you?
              </CardTitle>
              <CardDescription>
                Answer all questions to reflect on how you've been feeling.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQuestion.id}
                  className="rounded-xl border bg-card/70 p-5"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.26 }}
                >
                <div className="mb-4 flex items-center justify-between gap-2">
                  <Badge variant="outline">
                    Question {currentIndex + 1} / {ITEMS.length}
                  </Badge>
                </div>
                  <p className="mb-4 text-lg font-medium">{currentQuestion.text}</p>
                  <RadioGroup
                    value={currentAnswer === null ? undefined : String(currentAnswer)}
                    onValueChange={(value) => setAnswer(currentIndex, value)}
                    className="grid gap-2"
                  >
                    {OPTIONS.map((option, optionIndex) => {
                      const controlId = `q-${currentQuestion.id}-o-${option.value}`;
                      const isSelected = currentAnswer === option.value;
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
                            <span>
                              <span className="block text-sm font-medium">{option.label}</span>
                              <span className="text-xs text-muted-foreground">{option.hint}</span>
                            </span>
                            <RadioGroupItem id={controlId} value={String(option.value)} />
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
                  <Button onClick={finishAssessment} disabled={answeredCount < ITEMS.length}>
                    Finish & Calculate
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
                  <Badge variant="outline">Score range: 0-10</Badge>
                  <Badge variant="secondary">Your current score: {totalScore}</Badge>
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
