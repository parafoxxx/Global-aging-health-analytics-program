import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  DownloadIcon,
  MicIcon,
  PauseIcon,
  PlayIcon,
  RefreshCcwIcon,
  SkipForwardIcon,
  Volume2Icon,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type SurveyOption = {
  key: string;
  labelEn: string;
  labelHi: string;
  aliases: string[];
};

type SurveyQuestion = {
  id: string;
  en: string;
  hi: string;
  options: SurveyOption[];
};

type SurveyResponse = {
  questionId: string;
  selectedOptionKey: string;
  selectedOptionEn: string;
  selectedOptionHi: string;
  transcript: string;
  confidence: number | null;
  timestamp: string;
};

type WebSpeechRecognitionResult = {
  readonly isFinal: boolean;
  readonly [index: number]: {
    readonly transcript: string;
    readonly confidence: number;
  };
};

type WebSpeechRecognitionEvent = Event & {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: WebSpeechRecognitionResult;
  };
};

type WebSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => WebSpeechRecognition;
type ListenMode = "hi-IN" | "en-IN";

type SurveyDraft = {
  currentIndex: number;
  responses: SurveyResponse[];
};

const STORAGE_KEY = "gahasp_voice_survey_v2";

const QUESTIONS: SurveyQuestion[] = [
  {
    id: "Q1",
    en: "What is your gender?",
    hi: "आपका लिंग क्या है?",
    options: [
      { key: "opt_1", labelEn: "Male", labelHi: "पुरुष", aliases: ["male", "man", "पुरुष", "लड़का"] },
      { key: "opt_2", labelEn: "Female", labelHi: "महिला", aliases: ["female", "woman", "महिला", "लड़की"] },
      { key: "opt_3", labelEn: "Other", labelHi: "अन्य", aliases: ["other", "अन्य"] },
    ],
  },
  {
    id: "Q2",
    en: "Can you walk 500 meters without support?",
    hi: "क्या आप बिना सहारे 500 मीटर चल सकते हैं?",
    options: [
      { key: "opt_1", labelEn: "Yes", labelHi: "हाँ", aliases: ["yes", "haan", "हाँ", "जी"] },
      { key: "opt_2", labelEn: "No", labelHi: "नहीं", aliases: ["no", "nahi", "नहीं"] },
    ],
  },
  {
    id: "Q3",
    en: "What is your age group?",
    hi: "आपकी उम्र किस श्रेणी में आती है?",
    options: [
      { key: "opt_1", labelEn: "18-30", labelHi: "18 से 30", aliases: ["18 30", "18-30", "अठारह तीस"] },
      { key: "opt_2", labelEn: "31-45", labelHi: "31 से 45", aliases: ["31 45", "31-45"] },
      { key: "opt_3", labelEn: "46-60", labelHi: "46 से 60", aliases: ["46 60", "46-60"] },
      { key: "opt_4", labelEn: "60+", labelHi: "60 से ऊपर", aliases: ["60 plus", "60+", "साठ से ऊपर"] },
    ],
  },
];

const ORDINAL_ALIASES = [
  ["option 1", "first", "one", "पहला", "पहली", "एक"],
  ["option 2", "second", "two", "दूसरा", "दूसरी", "दो"],
  ["option 3", "third", "three", "तीसरा", "तीसरी", "तीन"],
  ["option 4", "fourth", "four", "चौथा", "चौथी", "चार"],
];

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAlias(haystack: string, alias: string) {
  if (!alias) return false;
  if (haystack === alias) return true;
  return ` ${haystack} `.includes(` ${alias} `);
}

function findVoice(preferredLang: string, preferredNames: string[] = []) {
  const voices = window.speechSynthesis.getVoices();
  const named = voices.find((voice) =>
    preferredNames.some((name) => voice.name.toLowerCase().includes(name.toLowerCase())),
  );
  if (named) return named;
  const exact = voices.find((voice) => voice.lang.toLowerCase() === preferredLang.toLowerCase());
  if (exact) return exact;
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(preferredLang.split("-")[0].toLowerCase()));
}

function detectSelectedOption(transcript: string, question: SurveyQuestion | null) {
  if (!question) return null;
  const normalized = normalizeForMatch(transcript);
  if (!normalized) return null;

  const aliasMatch = question.options.find((option) =>
    option.aliases.some((alias) => containsAlias(normalized, normalizeForMatch(alias))),
  );
  if (aliasMatch) return aliasMatch;

  const ordinalMatch = question.options.find((_, index) =>
    (ORDINAL_ALIASES[index] ?? []).some((alias) => containsAlias(normalized, normalizeForMatch(alias))),
  );
  return ordinalMatch ?? null;
}

function escapeCsv(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SurveyPage() {
  const navigate = useNavigate();
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const latestTranscriptRef = useRef("");
  const latestConfidenceRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [liveConfidence, setLiveConfidence] = useState<number | null>(null);
  const [listenMode, setListenMode] = useState<ListenMode>("hi-IN");
  const [visualizerLevels, setVisualizerLevels] = useState<number[]>(Array.from({ length: 24 }, () => 4));
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState("");

  const currentQuestion = QUESTIONS[currentIndex] ?? null;
  const responseMap = useMemo(() => new Map(responses.map((response) => [response.questionId, response])), [responses]);
  const savedCurrent = currentQuestion ? responseMap.get(currentQuestion.id) : null;
  const answeredCount = responseMap.size;
  const progressValue = (answeredCount / QUESTIONS.length) * 100;

  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const RecognitionAPI =
    (
      window as Window & {
        webkitSpeechRecognition?: SpeechRecognitionCtor;
        SpeechRecognition?: SpeechRecognitionCtor;
      }
    ).SpeechRecognition ??
    (
      window as Window & {
        webkitSpeechRecognition?: SpeechRecognitionCtor;
        SpeechRecognition?: SpeechRecognitionCtor;
      }
    ).webkitSpeechRecognition ??
    null;
  const canListen = RecognitionAPI !== null;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as SurveyDraft;
      if (typeof draft.currentIndex === "number") setCurrentIndex(Math.max(0, draft.currentIndex));
      if (Array.isArray(draft.responses)) setResponses(draft.responses);
    } catch {
      // Ignore malformed local cache.
    }
  }, []);

  useEffect(() => {
    const draft: SurveyDraft = { currentIndex, responses };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [currentIndex, responses]);

  useEffect(() => {
    const stopVisualizer = () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      analyserRef.current = null;
      audioContextRef.current?.close();
      audioContextRef.current = null;
      setVisualizerLevels(Array.from({ length: 24 }, () => 4));
    };

    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis.cancel();
      stopVisualizer();
    };
  }, []);

  const stopMicVisualizer = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setVisualizerLevels(Array.from({ length: 24 }, () => 4));
  };

  const startMicVisualizer = async () => {
    try {
      stopMicVisualizer();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      mediaStreamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const render = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const bucketSize = Math.floor(dataArray.length / 24) || 1;
        const nextLevels = Array.from({ length: 24 }, (_, index) => {
          const start = index * bucketSize;
          const end = Math.min(start + bucketSize, dataArray.length);
          let sum = 0;
          for (let i = start; i < end; i += 1) sum += dataArray[i];
          const avg = sum / Math.max(end - start, 1);
          return Math.max(4, Math.min(44, Math.round((avg / 255) * 44)));
        });
        setVisualizerLevels(nextLevels);
        animationFrameRef.current = requestAnimationFrame(render);
      };
      render();
    } catch {
      setError("Mic visualizer unavailable. Please allow microphone permission.");
    }
  };

  const saveResponse = (option: SurveyOption, transcript: string, confidence: number | null) => {
    if (!currentQuestion) return;
    const payload: SurveyResponse = {
      questionId: currentQuestion.id,
      selectedOptionKey: option.key,
      selectedOptionEn: option.labelEn,
      selectedOptionHi: option.labelHi,
      transcript,
      confidence,
      timestamp: new Date().toISOString(),
    };
    setResponses((prev) => {
      const withoutCurrent = prev.filter((item) => item.questionId !== currentQuestion.id);
      return [...withoutCurrent, payload];
    });
  };

  const speakQuestionAndOptions = () => {
    if (!currentQuestion || !canSpeak) return;
    window.speechSynthesis.cancel();
    setError("");
    setIsSpeaking(true);

    const optionLineEn = currentQuestion.options
      .map((option, index) => `Option ${index + 1}: ${option.labelEn}`)
      .join(". ");
    const optionLineHi = currentQuestion.options.map((option, index) => `विकल्प ${index + 1}: ${option.labelHi}`).join("। ");

    const segments = [
      {
        lang: "en-IN",
        text: `Question. ${currentQuestion.en}. Options are. ${optionLineEn}.`,
      },
      {
        lang: "hi-IN",
        text: `प्रश्न। ${currentQuestion.hi}। विकल्प हैं। ${optionLineHi}।`,
      },
    ];

    let cursor = 0;
    const speakNext = () => {
      const item = segments[cursor];
      if (!item) {
        setIsSpeaking(false);
        return;
      }
      cursor += 1;
      const utterance = new SpeechSynthesisUtterance(item.text);
      const voice =
        item.lang === "hi-IN"
          ? findVoice("hi-IN", ["hindi", "india"])
          : findVoice("en-IN", ["india", "english"]);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? item.lang;
      utterance.rate = item.lang === "hi-IN" ? 0.9 : 0.95;
      utterance.onend = speakNext;
      utterance.onerror = () => {
        setError("Speech playback failed on this browser/device.");
        setIsSpeaking(false);
      };
      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  };

  const startListening = () => {
    if (!RecognitionAPI || !canListen || !currentQuestion) return;
    setError("");
    setLiveTranscript("");
    setLiveConfidence(null);
    latestTranscriptRef.current = "";
    latestConfidenceRef.current = null;

    const recognition = new RecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = listenMode;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interim = "";
      let finalConfidence: number | null = latestConfidenceRef.current;

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript?.trim() ?? "";
        if (!transcript) continue;
        if (result.isFinal) {
          finalTranscript = `${finalTranscript} ${transcript}`.trim();
          finalConfidence = result[0]?.confidence ?? finalConfidence;
        } else {
          interim = `${interim} ${transcript}`.trim();
        }
      }
      const merged = `${finalTranscript} ${interim}`.trim();
      latestTranscriptRef.current = merged;
      latestConfidenceRef.current = finalConfidence;
      setLiveTranscript(merged);
      setLiveConfidence(finalConfidence);
    };

    recognition.onerror = (event) => {
      setError(`Mic recognition error: ${event.error ?? "unknown"}`);
      setIsListening(false);
      stopMicVisualizer();
    };

    recognition.onend = () => {
      setIsListening(false);
      stopMicVisualizer();
      const transcript = latestTranscriptRef.current.trim();
      const detected = detectSelectedOption(transcript, currentQuestion);
      if (detected) {
        saveResponse(detected, transcript, latestConfidenceRef.current);
      } else if (transcript.trim()) {
        setError("Could not match a valid option. Please say option text or option number.");
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
    void startMicVisualizer();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    stopMicVisualizer();
  };

  const goNext = () => {
    setLiveTranscript("");
    setLiveConfidence(null);
    setError("");
    setCurrentIndex((prev) => Math.min(prev + 1, QUESTIONS.length - 1));
  };

  const goPrevious = () => {
    setLiveTranscript("");
    setLiveConfidence(null);
    setError("");
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const exportJson = () => {
    const ordered = QUESTIONS.map((question) => responseMap.get(question.id)).filter(
      (item): item is SurveyResponse => Boolean(item),
    );
    downloadTextFile("survey_responses.json", JSON.stringify(ordered, null, 2), "application/json");
  };

  const exportCsv = () => {
    const header = [
      "question_id",
      "question_en",
      "question_hi",
      "selected_option_en",
      "selected_option_hi",
      "transcript",
      "confidence",
      "timestamp",
    ];
    const lines = QUESTIONS.map((question) => {
      const row = responseMap.get(question.id);
      if (!row) return null;
      return [
        question.id,
        question.en,
        question.hi,
        row.selectedOptionEn,
        row.selectedOptionHi,
        row.transcript,
        row.confidence === null ? "" : row.confidence.toFixed(3),
        row.timestamp,
      ]
        .map(escapeCsv)
        .join(",");
    }).filter((line): line is string => Boolean(line));

    downloadTextFile("survey_responses.csv", [header.map(escapeCsv).join(","), ...lines].join("\n"), "text/csv");
  };

  const resetSurvey = () => {
    recognitionRef.current?.stop();
    stopMicVisualizer();
    setCurrentIndex(0);
    setResponses([]);
    setLiveTranscript("");
    setLiveConfidence(null);
    latestTranscriptRef.current = "";
    latestConfidenceRef.current = null;
    setIsListening(false);
    setError("");
    window.localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_12%_0%,color-mix(in_oklch,var(--chart-2)_18%,transparent),transparent_34%),linear-gradient(to_bottom,var(--background),color-mix(in_oklch,var(--accent)_24%,var(--background)))] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-11 w-11 rounded-md object-contain" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Voice Survey Bot</h1>
              <p className="text-sm text-muted-foreground">Bilingual question + option speaking and voice answer capture</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeftIcon className="mr-2 size-4" />
              Home
            </Button>
            <Button variant="outline" onClick={resetSurvey}>
              <RefreshCcwIcon className="mr-2 size-4" />
              Reset
            </Button>
            <Button variant="outline" onClick={exportJson} disabled={answeredCount === 0}>
              <DownloadIcon className="mr-2 size-4" />
              JSON
            </Button>
            <Button onClick={exportCsv} disabled={answeredCount === 0}>
              <DownloadIcon className="mr-2 size-4" />
              CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Question {currentIndex + 1} / {QUESTIONS.length}
                {savedCurrent && (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2Icon className="size-3.5" />
                    Saved
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Question and options are shown in English + Hindi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">English</p>
                <p className="mt-1 text-lg font-medium">{currentQuestion?.en}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hindi</p>
                <p className="mt-1 text-lg font-medium">{currentQuestion?.hi}</p>
              </div>

              <div className="grid gap-2">
                {currentQuestion?.options.map((option, index) => {
                  const isSaved = savedCurrent?.selectedOptionKey === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => saveResponse(option, `manual_select_option_${index + 1}`, null)}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        isSaved ? "border-primary bg-primary/10" : "hover:border-primary/40"
                      }`}
                    >
                      <p className="text-sm font-medium">
                        {index + 1}. {option.labelEn}
                      </p>
                      <p className="text-sm text-muted-foreground">{option.labelHi}</p>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={speakQuestionAndOptions} disabled={!canSpeak || isSpeaking}>
                  <Volume2Icon className="mr-2 size-4" />
                  {isSpeaking ? "Speaking..." : "Speak Question + Options"}
                </Button>
                <div className="flex items-center gap-1 rounded-lg border p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={listenMode === "hi-IN" ? "default" : "ghost"}
                    onClick={() => setListenMode("hi-IN")}
                  >
                    Hindi
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={listenMode === "en-IN" ? "default" : "ghost"}
                    onClick={() => setListenMode("en-IN")}
                  >
                    English
                  </Button>
                </div>
                {!isListening ? (
                  <Button variant="outline" onClick={startListening} disabled={!canListen}>
                    <MicIcon className="mr-2 size-4" />
                    Say Option
                  </Button>
                ) : (
                  <Button variant="outline" onClick={stopListening}>
                    <PauseIcon className="mr-2 size-4" />
                    Stop
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="outline" onClick={goPrevious} disabled={currentIndex <= 0}>
                  <PlayIcon className="mr-2 size-4 rotate-180" />
                  Previous
                </Button>
                <Button onClick={goNext} disabled={currentIndex >= QUESTIONS.length - 1}>
                  <SkipForwardIcon className="mr-2 size-4" />
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Progress</CardTitle>
                <CardDescription>
                  {answeredCount} of {QUESTIONS.length} saved
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={progressValue} />
                {savedCurrent ? (
                  <div className="rounded-lg border bg-primary/10 p-3 text-sm">
                    <p className="font-medium">
                      Saved: {savedCurrent.selectedOptionEn} / {savedCurrent.selectedOptionHi}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No saved option for this question yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Voice Input</CardTitle>
                <CardDescription>Say option text or number ({listenMode})</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Mic Visualizer
                  </p>
                  <div className="flex h-12 items-end gap-1">
                    {visualizerLevels.map((level, index) => (
                      <span
                        key={`bar-${index}`}
                        className={`w-1.5 rounded-t transition-all duration-75 ${
                          isListening ? "bg-primary" : "bg-muted-foreground/30"
                        }`}
                        style={{ height: `${level}px` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="min-h-10 text-sm">{liveTranscript || "No speech captured yet."}</p>
                </div>
                {liveConfidence !== null && (
                  <p className="text-xs text-muted-foreground">Confidence: {(liveConfidence * 100).toFixed(1)}%</p>
                )}
                {error && (
                  <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
                {!canSpeak && <Badge variant="destructive">Speech playback not supported</Badge>}
                {!canListen && <Badge variant="destructive">Speech recognition not supported</Badge>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
