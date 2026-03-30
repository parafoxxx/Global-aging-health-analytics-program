import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  LoaderCircleIcon,
  RefreshCcwIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { AssessmentLockedCard } from "@/components/AssessmentLockedCard";
import { ParticipantIntakeCard } from "@/components/ParticipantIntakeCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  AssessmentApiError,
  getStoredParticipantProfile,
  submitAssessmentSubmission,
  useParticipantSubmissionStatuses,
  type StoredParticipantProfile,
} from "@/lib/assessment-api";

const CONSENT_TEXT = {
  title: "Consent Form",
  summary:
    "Before starting this self-check, please confirm that you understand how your responses may be used.",
  points: [
    "I understand this assessment is a screening tool and not a medical diagnosis.",
    "I am voluntarily providing my responses for assessment and research-support purposes.",
    "I understand my information may be reviewed in aggregated or research-related analysis.",
    "I understand I should speak with a qualified professional for medical advice or urgent concerns.",
  ],
  checkbox:
    "I have read this information and I consent to provide my responses for assessment and research-related use.",
};
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type FrailtyOption = {
  value: number;
  label: string;
  hint?: string;
};

type FrailtyItem = {
  id: number;
  domain: string;
  text: string;
  options: FrailtyOption[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

const YES_NO_OPTIONS: FrailtyOption[] = [
  { value: 0, label: "No", hint: "Score 0" },
  { value: 1, label: "Yes", hint: "Score 1" },
];

const FIVE_LEVEL_FUNCTION_OPTIONS: FrailtyOption[] = [
  { value: 0, label: "Excellent", hint: "Score 0" },
  { value: 0.25, label: "Very good", hint: "Score 0.25" },
  { value: 0.5, label: "Good", hint: "Score 0.5" },
  { value: 0.75, label: "Fair", hint: "Score 0.75" },
  { value: 1, label: "Poor", hint: "Score 1" },
];

const FIVE_LEVEL_FREQUENCY_OPTIONS: FrailtyOption[] = [
  { value: 1, label: "Always", hint: "Score 1" },
  { value: 0.75, label: "Often", hint: "Score 0.75" },
  { value: 0.5, label: "Sometimes", hint: "Score 0.5" },
  { value: 0.25, label: "Seldom", hint: "Score 0.25" },
  { value: 0, label: "Rarely or never", hint: "Score 0" },
];

const LIFE_RATING_OPTIONS: FrailtyOption[] = [
  { value: 0, label: "Very good", hint: "Score 0" },
  { value: 0.25, label: "Good", hint: "Score 0.25" },
  { value: 0.5, label: "Okay", hint: "Score 0.5" },
  { value: 0.75, label: "Bad", hint: "Score 0.75" },
  { value: 1, label: "Very bad", hint: "Score 1" },
];

const SLEEP_OPTIONS: FrailtyOption[] = [
  { value: 1, label: "Most of the time", hint: "Score 1" },
  { value: 0, label: "Sometimes", hint: "Score 0" },
  { value: 0, label: "Rarely or never", hint: "Score 0" },
];

const ITEMS: FrailtyItem[] = [
  { id: 1, domain: "Self-rated health", text: "How do you rate your life at present?", options: LIFE_RATING_OPTIONS },
  { id: 2, domain: "Mobility", text: "Do you have difficulty with walking 100 yards?", options: YES_NO_OPTIONS },
  { id: 3, domain: "Mobility", text: "Do you have difficulty with sitting for 2 hours or more?", options: YES_NO_OPTIONS },
  {
    id: 4,
    domain: "Mobility",
    text: "Do you have difficulty with getting up from a chair after sitting for long period?",
    options: YES_NO_OPTIONS,
  },
  {
    id: 5,
    domain: "Mobility",
    text: "Do you have difficulty with climbing one flight of stairs without resting?",
    options: YES_NO_OPTIONS,
  },
  { id: 6, domain: "Mobility", text: "Do you have difficulty with stooping, kneeling or crouching?", options: YES_NO_OPTIONS },
  {
    id: 7,
    domain: "Mobility",
    text: "Do you have difficulty with reaching or extending arms above shoulder level (either arm)?",
    options: YES_NO_OPTIONS,
  },
  { id: 8, domain: "Mobility", text: "Do you have difficulty with pulling or pushing large objects?", options: YES_NO_OPTIONS },
  {
    id: 9,
    domain: "Mobility",
    text: "Do you have difficulty with lifting or carrying weights over 5 kilos, like a heavy bag of groceries?",
    options: YES_NO_OPTIONS,
  },
  { id: 10, domain: "Mobility", text: "Do you have difficulty with picking up a coin from a table?", options: YES_NO_OPTIONS },
  {
    id: 11,
    domain: "Sensory",
    text: "How good is your eyesight for seeing things at a distance, like recognizing a friend across the street, using glasses or corrective lens as needed?",
    options: FIVE_LEVEL_FUNCTION_OPTIONS,
  },
  {
    id: 12,
    domain: "Sensory",
    text: "How good is your eyesight for seeing things up close, like reading ordinary newspaper print, using glasses or corrective lenses as needed?",
    options: FIVE_LEVEL_FUNCTION_OPTIONS,
  },
  {
    id: 13,
    domain: "Sensory",
    text: "Is your hearing excellent, very good, good, fair, or poor using a hearing aid as usual?",
    options: FIVE_LEVEL_FUNCTION_OPTIONS,
  },
  { id: 14, domain: "ADL", text: "Do you have difficulty with dressing, including putting on chappals, shoes, etc.?", options: YES_NO_OPTIONS },
  { id: 15, domain: "ADL", text: "Do you have difficulty with walking across a room?", options: YES_NO_OPTIONS },
  { id: 16, domain: "ADL", text: "Do you have difficulty with bathing?", options: YES_NO_OPTIONS },
  { id: 17, domain: "ADL", text: "Do you have difficulty with eating?", options: YES_NO_OPTIONS },
  { id: 18, domain: "ADL", text: "Do you have difficulty with getting in or out of bed?", options: YES_NO_OPTIONS },
  { id: 19, domain: "ADL", text: "Do you have difficulty with using the toilet, including getting up and down?", options: YES_NO_OPTIONS },
  { id: 20, domain: "IADL", text: "Do you have difficulty with preparing a hot meal (cooking and serving)?", options: YES_NO_OPTIONS },
  { id: 21, domain: "IADL", text: "Do you have difficulty with shopping for groceries?", options: YES_NO_OPTIONS },
  { id: 22, domain: "IADL", text: "Do you have difficulty with making telephone calls?", options: YES_NO_OPTIONS },
  { id: 23, domain: "IADL", text: "Taking medications?", options: YES_NO_OPTIONS },
  { id: 24, domain: "IADL", text: "Do you have difficulty with doing work around the house or garden?", options: YES_NO_OPTIONS },
  { id: 25, domain: "IADL", text: "Do you have difficulty with managing money, such as paying bills and keeping track of expenses?", options: YES_NO_OPTIONS },
  { id: 26, domain: "IADL", text: "Do you have difficulty with getting around or finding address in unfamiliar place?", options: YES_NO_OPTIONS },
  { id: 27, domain: "Comorbidities", text: "Has any health professional ever told you that you have hypertension (high blood pressure)?", options: YES_NO_OPTIONS },
  { id: 28, domain: "Comorbidities", text: "Has any health professional ever told you that you have diabetes or high blood sugar?", options: YES_NO_OPTIONS },
  { id: 29, domain: "Comorbidities", text: "Has any health professional ever told you that you have had a stroke?", options: YES_NO_OPTIONS },
  {
    id: 30,
    domain: "Comorbidities",
    text: "Has any health professional ever told you that you have a chronic lung disease such as asthma, chronic obstructive pulmonary disease (COPD), chronic bronchitis, or other chronic lung problems?",
    options: YES_NO_OPTIONS,
  },
  {
    id: 31,
    domain: "Comorbidities",
    text: "Has any health professional ever told you that you have any neurological or psychiatric problems such as depression, Alzheimer's/dementia, bipolar disorder, convulsions, Parkinson's disease, etc.?",
    options: YES_NO_OPTIONS,
  },
  {
    id: 32,
    domain: "Comorbidities",
    text: "Has any health professional ever told you that you have arthritis, rheumatism, osteoporosis, or other bone/joint diseases?",
    options: YES_NO_OPTIONS,
  },
  {
    id: 33,
    domain: "Comorbidities",
    text: "Has any health professional ever told you that you have chronic heart disease such as coronary heart disease (heart attack or myocardial infarction), congestive heart failure, or other chronic heart problems?",
    options: YES_NO_OPTIONS,
  },
  { id: 34, domain: "Comorbidities", text: "Has any health professional ever told you that you have cancer or a malignant tumor?", options: YES_NO_OPTIONS },
  { id: 35, domain: "Mood and cognition", text: "Do you often feel fearful or anxious?", options: FIVE_LEVEL_FREQUENCY_OPTIONS },
  {
    id: 36,
    domain: "Mood and cognition",
    text: "Do you feel the older you get, the more useless you are, and have trouble doing anything?",
    options: FIVE_LEVEL_FREQUENCY_OPTIONS,
  },
  { id: 37, domain: "Mood and cognition", text: "Do you always look on the bright side of things?", options: FIVE_LEVEL_FREQUENCY_OPTIONS },
  { id: 38, domain: "Mood and cognition", text: "Can you make your own decisions concerning your personal affairs?", options: FIVE_LEVEL_FREQUENCY_OPTIONS },
  { id: 39, domain: "Falls", text: "Have you fallen down in the last two years?", options: YES_NO_OPTIONS },
  { id: 40, domain: "Sleep", text: "How often do you have trouble falling asleep?", options: SLEEP_OPTIONS },
];

function classifyFi(score: number) {
  if (score >= 0.25) {
    return {
      label: "Frailty threshold reached",
      detail: "This score is at or above the FI cutoff of 0.25 used in your Rockwood document.",
      tone: "destructive" as const,
    };
  }

  return {
    label: "Below frailty threshold",
    detail: "This score is below the FI cutoff of 0.25 used in your Rockwood document.",
    tone: "outline" as const,
  };
}

export default function FrailtyTestPage() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Array<number | null>>(Array.from({ length: ITEMS.length }, () => null));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentedAt, setConsentedAt] = useState<string | null>(null);
  const [participantProfile, setParticipantProfile] = useState<StoredParticipantProfile | null>(() =>
    getStoredParticipantProfile(),
  );
  const [isEditingProfile, setIsEditingProfile] = useState(() => getStoredParticipantProfile() === null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(true);
  const saveInFlightRef = useRef(false);
  const submissionStatusQuery = useParticipantSubmissionStatuses(participantProfile?.externalParticipantId);
  const currentSubmission = submissionStatusQuery.data?.find((item) => item.assessmentType === "frailty") ?? null;
  const currentQuestion = ITEMS[currentIndex];
  const currentAnswer = answers[currentIndex];

  const answeredCount = useMemo(() => answers.filter((value) => value !== null).length, [answers]);
  const progressValue = (answeredCount / ITEMS.length) * 100;
  const totalScore = useMemo(() => answers.reduce<number>((sum, value) => sum + (value ?? 0), 0), [answers]);
  const fiScore = totalScore / ITEMS.length;
  const result = classifyFi(fiScore);

  const handleParticipantSave = (profile: StoredParticipantProfile) => {
    setParticipantProfile(profile);
    setIsEditingProfile(false);
    setSaveState("idle");
    setSaveError("");
    setSubmissionId(null);
    setHasUnsavedChanges(true);
  };

  const saveAssessment = async () => {
    if (!participantProfile || saveInFlightRef.current) return;
    if (!hasUnsavedChanges && saveState === "saved") return;

    saveInFlightRef.current = true;
    setSaveState("saving");
    setSaveError("");

    try {
      const response = await submitAssessmentSubmission({
        participant: participantProfile,
        assessment: {
          type: "frailty",
          totalScore,
          maxScore: ITEMS.length,
          normalizedScore: fiScore,
          resultLabel: result.label,
          answers: ITEMS.map((item, index) => {
            const selectedValue = answers[index];
            const selectedOption = item.options.find((option) => option.value === selectedValue) ?? null;

            return {
              itemId: item.id,
              domain: item.domain,
              prompt: item.text,
              selectedValue,
              selectedLabel: selectedOption?.label ?? null,
              selectedHint: selectedOption?.hint ?? null,
            };
          }),
          metadata: {
            instrument: "Rockwood frailty index (40 items)",
            consentedAt: consentedAt ?? new Date().toISOString(),
            answeredCount: ITEMS.length,
          },
        },
      });

      setSaveState("saved");
      setSubmissionId(response.submissionId);
      setHasUnsavedChanges(false);
    } catch (error) {
      if (error instanceof AssessmentApiError && error.status === 409) {
        setShowResult(false);
        await submissionStatusQuery.refetch();
      }
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Failed to save assessment.");
    } finally {
      saveInFlightRef.current = false;
    }
  };

  const setAnswer = (index: number, value: string) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = numeric;
      return next;
    });
    setShowResult(false);
    setSaveState("idle");
    setSaveError("");
    setSubmissionId(null);
    setHasUnsavedChanges(true);
  };

  const resetTest = () => {
    setAnswers(Array.from({ length: ITEMS.length }, () => null));
    setCurrentIndex(0);
    setShowResult(false);
    setHasConsent(false);
    setConsentChecked(false);
    setConsentedAt(null);
    setSaveState("idle");
    setSaveError("");
    setSubmissionId(null);
    setHasUnsavedChanges(true);
  };

  const goNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, ITEMS.length - 1));
  };

  const goPrev = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const finishAssessment = () => {
    if (saveInFlightRef.current || saveState === "saving") return;
    if (answeredCount < ITEMS.length) return;
    setShowResult(true);
    void saveAssessment();
  };

  const scorePercent = Math.min((fiScore / 0.4) * 100, 100);
  const riskTrackClass =
    fiScore >= 0.25
      ? "from-amber-500/80 via-orange-500/80 to-red-500/80"
      : "from-emerald-500/80 via-teal-500/80 to-cyan-500/80";

  if (!participantProfile || isEditingProfile) {
    return (
      <ParticipantIntakeCard
        title="Frailty Self-Check"
        description="Collect participant details once, then attach them to each finished assessment."
        initialProfile={participantProfile}
        onSave={handleParticipantSave}
        onCancel={() => navigate("/")}
      />
    );
  }

  if (submissionStatusQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_36%),linear-gradient(to_bottom,var(--background),color-mix(in_oklch,var(--accent)_24%,var(--background)))] px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardContent className="flex items-center gap-3 pt-6 text-sm text-muted-foreground">
              <LoaderCircleIcon className="size-5 animate-spin" />
              Checking whether this participant has already submitted the frailty assessment.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (currentSubmission && !showResult) {
    return (
      <AssessmentLockedCard
        title="Frailty Self-Check"
        description="One submission per participant is allowed for this assessment."
        submission={currentSubmission}
        onHome={() => navigate("/")}
      />
    );
  }

  if (!hasConsent) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_36%),linear-gradient(to_bottom,var(--background),color-mix(in_oklch,var(--accent)_24%,var(--background)))] px-4 py-8">
        <motion.div
          className="mx-auto max-w-3xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-11 w-11 rounded-md object-contain" />
              <div>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Frailty Self-Check</h1>
                <p className="text-sm text-muted-foreground">Consent required before starting</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeftIcon className="mr-2 size-4" />
              Home
            </Button>
          </div>

          <Card className="mb-5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Participant Details</CardTitle>
              <CardDescription>
                {participantProfile.age} years old, {participantProfile.gender}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>{participantProfile.name || "Name not collected"}</p>
                <p>{[participantProfile.city, participantProfile.stateRegion, participantProfile.country].filter(Boolean).join(", ")}</p>
              </div>
              <Button variant="outline" onClick={() => setIsEditingProfile(true)}>
                Edit Details
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{CONSENT_TEXT.title}</CardTitle>
              <CardDescription>{CONSENT_TEXT.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-xl border bg-card/70 p-4">
                <div className="space-y-3 text-sm text-muted-foreground">
                  {CONSENT_TEXT.points.map((point) => (
                    <p key={point}>{point}</p>
                  ))}
                </div>
              </div>

              <Label
                htmlFor="frailty-consent"
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  consentChecked ? "border-primary bg-primary/10 ring-1 ring-primary/40" : "hover:border-primary/40"
                }`}
              >
                <input
                  id="frailty-consent"
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(event) => setConsentChecked(event.target.checked)}
                  className="mt-1 size-4"
                />
                <span className="text-sm">{CONSENT_TEXT.checkbox}</span>
              </Label>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => navigate("/")}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setHasConsent(true);
                    setConsentedAt(new Date().toISOString());
                  }}
                  disabled={!consentChecked}
                >
                  Start Test
                  <ArrowRightIcon className="ml-2 size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

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
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Frailty Self-Check</h1>
                <p className="text-sm text-muted-foreground">Assessment Result</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {saveState !== "saved" ? (
                <Button variant="outline" onClick={() => setShowResult(false)}>
                  Review Answers
                </Button>
              ) : null}
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
                <CardDescription>40-item Rockwood frailty index</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-xl border bg-card/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Frailty Index</p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-5xl font-semibold leading-none">{fiScore.toFixed(3)}</span>
                    <span className="pb-1 text-sm text-muted-foreground">/ 1.000</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Deficit sum: {totalScore.toFixed(2)} / {ITEMS.length}
                  </p>
                  <div className="mt-4">
                    <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full w-full bg-gradient-to-r ${riskTrackClass}`} />
                      <div
                        className="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow"
                        style={{ left: `calc(${scorePercent}% - 8px)` }}
                        aria-hidden
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                      <span>Lower (0.00)</span>
                      <span>Threshold (0.25)</span>
                      <span>Higher (0.40+)</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border bg-accent/20 p-4">
                  <Badge variant={result.tone}>{result.label}</Badge>
                  <p className="text-sm text-muted-foreground">{result.detail}</p>
                  <p className="rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
                    Screening note: This tool calculates frailty index as total deficits divided by 40 variables. It
                    does not provide a diagnosis.
                  </p>
                </div>

                <div className="rounded-xl border bg-card/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Backend Storage</p>
                      <p className="text-xs text-muted-foreground">
                        Participant details, deficit score, and all 40 answers are sent to the backend.
                      </p>
                    </div>
                    {saveState === "saving" ? (
                      <Badge variant="secondary" className="gap-1">
                        <LoaderCircleIcon className="size-3.5 animate-spin" />
                        Saving
                      </Badge>
                    ) : saveState === "saved" ? (
                      <Badge variant="secondary">Saved</Badge>
                    ) : saveState === "error" ? (
                      <Badge variant="destructive">Save failed</Badge>
                    ) : null}
                  </div>

                  {saveState === "saved" ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Submission {submissionId ?? ""} stored successfully.
                    </p>
                  ) : null}

                  {saveState === "error" ? (
                    <div className="mt-3 space-y-3">
                      <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                        {saveError}
                      </p>
                      <Button size="sm" variant="outline" onClick={() => void saveAssessment()}>
                        Retry Save
                      </Button>
                    </div>
                  ) : null}
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
                        Consider speaking with a clinician
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        A clinician can review the score in context and look at mobility, daily function, sleep, and comorbidities together.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <CheckCircle2Icon className="size-4 text-emerald-600" />
                        Continue routine monitoring
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Recheck if daily function, mobility, chronic conditions, or sleep changes.
                      </p>
                    </div>
                  )}
                  {saveState === "saved" ? (
                    <p className="rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
                      This submission is final. Retakes are disabled for this participant.
                    </p>
                  ) : (
                    <Button className="w-full" variant="outline" onClick={resetTest}>
                      <RefreshCcwIcon className="mr-2 size-4" />
                      Retake Test
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Scoring Guide</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <p>FI = total deficits / 40</p>
                  <p>Below 0.25: below threshold</p>
                  <p>0.25 or above: frailty threshold reached</p>
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
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Frailty Self-Check</h1>
              <p className="text-sm text-muted-foreground">Rockwood questionnaire style flow (40 items)</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setIsEditingProfile(true)}>
              Edit Details
            </Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeftIcon className="mr-2 size-4" />
              Home
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardListIcon className="size-4 text-muted-foreground" />
                Answer all questions to calculate frailty index
              </CardTitle>
              <CardDescription>
                This uses the 40 variables and score values from your Rockwood frailty document.
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
                    <Badge variant="secondary">{currentQuestion.domain}</Badge>
                  </div>
                  <p className="mb-4 text-lg font-medium">{currentQuestion.text}</p>
                  <RadioGroup
                    value={currentAnswer === null ? undefined : String(currentAnswer)}
                    onValueChange={(value) => setAnswer(currentIndex, value)}
                    className="grid gap-2"
                  >
                    {currentQuestion.options.map((option, optionIndex) => {
                      const controlId = `q-${currentQuestion.id}-o-${optionIndex}`;
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
                              {option.hint ? <span className="text-xs text-muted-foreground">{option.hint}</span> : null}
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
                  <Button onClick={finishAssessment} disabled={answeredCount < ITEMS.length || saveState === "saving"}>
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
                <Badge variant="outline">FI range: 0-1</Badge>
                <div className="rounded-lg border bg-card/70 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Participant</p>
                  <p>{participantProfile.name || "Name not collected"}</p>
                  <p>{[participantProfile.city, participantProfile.stateRegion, participantProfile.country].filter(Boolean).join(", ")}</p>
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


