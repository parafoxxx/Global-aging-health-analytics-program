import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  DownloadIcon,
  LanguagesIcon,
  MicIcon,
  PauseIcon,
  PlayIcon,
  SaveIcon,
  SkipForwardIcon,
  Volume2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { BrandLogo } from "@/components/BrandLogo";

type AskMode = "en" | "hi" | "both";
type ListenMode = "en-IN" | "hi-IN";

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
  questionEn: string;
  questionHi: string;
  askedIn: AskMode;
  transcript: string;
  confidence: number | null;
  selectedOptionKey?: string;
  selectedOptionEn?: string;
  selectedOptionHi?: string;
  matchType?: "alias" | "ordinal";
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

type SurveyDraft = {
  script: string;
  responses: SurveyResponse[];
  currentIndex: number;
  askMode: AskMode;
  listenMode: ListenMode;
};

const STORAGE_KEY = "gahasp_voice_survey_draft_v1";

const DEFAULT_SCRIPT = [
  "What is your gender? | आपका लिंग क्या है? | Male/पुरुष, Female/महिला, Other/अन्य",
  "Can you walk 500 meters without support? | क्या आप बिना सहारे 500 मीटर चल सकते हैं? | Yes/हाँ, No/नहीं",
  "What is your age group? | आपकी उम्र किस श्रेणी में आती है? | 18-30/18 से 30, 31-45/31 से 45, 46-60/46 से 60, 60+/60 से ऊपर",
].join("\n");

const ORDINAL_ALIASES = [
  ["option 1", "first", "one", "पहला", "पहली", "एक"],
  ["option 2", "second", "two", "दूसरा", "दूसरी", "दो"],
  ["option 3", "third", "three", "तीसरा", "तीसरी", "तीन"],
  ["option 4", "fourth", "four", "चौथा", "चौथी", "चार"],
  ["option 5", "fifth", "five", "पांचवा", "पांचवीं", "पांच"],
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

function parseOptions(raw: string): SurveyOption[] {
  if (!raw.trim()) return [];
  return raw
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, index) => {
      const [pair, ...extraAliasChunks] = chunk
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean);
      const [enRaw, hiRaw] = (pair ?? "").split("/", 2).map((item) => item.trim());
      const labelEn = enRaw || `Option ${index + 1}`;
      const labelHi = hiRaw || labelEn;
      const extraAliases = extraAliasChunks
        .flatMap((item) => item.split("/"))
        .map((item) => item.trim())
        .filter(Boolean);
      const aliases = Array.from(
        new Set(
          [labelEn, labelHi, ...extraAliases]
            .map((item) => normalizeForMatch(item))
            .filter(Boolean),
        ),
      );
      return {
        key: `opt_${index + 1}`,
        labelEn,
        labelHi,
        aliases,
      };
    });
}

function parseScript(script: string): SurveyQuestion[] {
  const lines = script
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  return lines.map((line, index) => {
    const [left, right, ...optionParts] = line.split("|").map((value) => value?.trim() ?? "");
    const en = left || `Question ${index + 1}`;
    const hi = right || left || `प्रश्न ${index + 1}`;
    const options = parseOptions(optionParts.join("|"));
    return {
      id: `Q${index + 1}`,
      en,
      hi,
      options,
    };
  });
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

function findVoice(preferredLang: string, preferredNames: string[] = []) {
  const voices = window.speechSynthesis.getVoices();
  const named = voices.find((voice) =>
    preferredNames.some((name) => voice.name.toLowerCase().includes(name.toLowerCase())),
  );
  if (named) return named;
  const exact = voices.find((voice) => voice.lang.toLowerCase() === preferredLang.toLowerCase());
  if (exact) return exact;
  const startsWith = voices.find((voice) =>
    voice.lang.toLowerCase().startsWith(preferredLang.split("-")[0].toLowerCase()),
  );
  return startsWith ?? null;
}

function detectSelectedOption(transcript: string, question: SurveyQuestion | null) {
  if (!question || question.options.length === 0) return null;
  const normalized = normalizeForMatch(transcript);
  if (!normalized) return null;

  const aliasMatch = question.options.find((option) =>
    option.aliases.some((alias) => containsAlias(normalized, alias)),
  );
  if (aliasMatch) return { option: aliasMatch, matchType: "alias" as const };

  const ordinalMatch = question.options.find((_, index) =>
    (ORDINAL_ALIASES[index] ?? []).some((alias) => containsAlias(normalized, normalizeForMatch(alias))),
  );
  if (ordinalMatch) return { option: ordinalMatch, matchType: "ordinal" as const };

  return null;
}

export default function SurveyPage() {
  const navigate = useNavigate();
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [askMode, setAskMode] = useState<AskMode>("both");
  const [listenMode, setListenMode] = useState<ListenMode>("hi-IN");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [liveConfidence, setLiveConfidence] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState("");

  const questions = useMemo(() => parseScript(script), [script]);
  const currentQuestion = questions[currentIndex] ?? null;

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
      if (typeof draft.script === "string") setScript(draft.script);
      if (Array.isArray(draft.responses)) setResponses(draft.responses);
      if (typeof draft.currentIndex === "number") setCurrentIndex(Math.max(0, draft.currentIndex));
      if (draft.askMode === "en" || draft.askMode === "hi" || draft.askMode === "both") {
        setAskMode(draft.askMode);
      }
      if (draft.listenMode === "en-IN" || draft.listenMode === "hi-IN") {
        setListenMode(draft.listenMode);
      }
    } catch {
      // Ignore malformed local storage content.
    }
  }, []);

  useEffect(() => {
    const draft: SurveyDraft = { script, responses, currentIndex, askMode, listenMode };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [script, responses, currentIndex, askMode, listenMode]);

  useEffect(() => {
    if (!currentQuestion) {
      setCurrentIndex(0);
      return;
    }
    if (currentIndex > questions.length - 1) setCurrentIndex(questions.length - 1);
  }, [questions, currentIndex, currentQuestion]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!canSpeak) return;
    const synth = window.speechSynthesis;
    const loadVoices = () => synth.getVoices();
    loadVoices();
    synth.addEventListener("voiceschanged", loadVoices);
    return () => synth.removeEventListener("voiceschanged", loadVoices);
  }, [canSpeak]);

  const selectedFromTranscript = useMemo(
    () => detectSelectedOption(liveTranscript, currentQuestion),
    [liveTranscript, currentQuestion],
  );

  const speakCurrentQuestion = () => {
    if (!currentQuestion || !canSpeak) return;
    window.speechSynthesis.cancel();

    const optionsEn =
      currentQuestion.options.length > 0
        ? `Your options are: ${currentQuestion.options
            .map((option, index) => `Option ${index + 1}: ${option.labelEn}`)
            .join(". ")}.`
        : "";
    const optionsHi =
      currentQuestion.options.length > 0
        ? `विकल्प हैं: ${currentQuestion.options
            .map((option, index) => `विकल्प ${index + 1}: ${option.labelHi}`)
            .join("। ")}।`
        : "";

    const segments =
      askMode === "both"
        ? [
            { lang: "en-IN", text: `Please answer clearly. ${currentQuestion.en} ${optionsEn}`.trim() },
            {
              lang: "hi-IN",
              text: `कृपया ध्यान से सुनिए। ${currentQuestion.hi} ${optionsHi} कृपया स्पष्ट बोलकर उत्तर दीजिए।`.trim(),
            },
          ]
        : askMode === "en"
          ? [{ lang: "en-IN", text: `Please answer clearly. ${currentQuestion.en} ${optionsEn}`.trim() }]
          : [
              {
                lang: "hi-IN",
                text: `कृपया ध्यान से सुनिए। ${currentQuestion.hi} ${optionsHi} कृपया स्पष्ट बोलकर उत्तर दीजिए।`.trim(),
              },
            ];

    let cursor = 0;
    setIsSpeaking(true);
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
      utterance.rate = item.lang === "hi-IN" ? 0.88 : 0.93;
      utterance.pitch = 1;
      utterance.onend = speakNext;
      utterance.onerror = () => {
        setIsSpeaking(false);
        setError("Speech playback failed on this browser/device.");
      };
      window.speechSynthesis.speak(utterance);
    };

    setError("");
    speakNext();
  };

  const startListening = () => {
    if (!canListen || !RecognitionAPI) return;
    setError("");
    setLiveTranscript("");
    setLiveConfidence(null);

    const recognition = new RecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = listenMode;
    recognition.maxAlternatives = 1;

    let finalTranscript = "";
    let finalConfidence: number | null = null;

    recognition.onresult = (event) => {
      let interim = "";
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
      setLiveTranscript(`${finalTranscript} ${interim}`.trim());
      setLiveConfidence(finalConfidence);
    };

    recognition.onerror = (event) => {
      setError(`Mic recognition error: ${event.error ?? "unknown"}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const saveCurrentResponse = () => {
    if (!currentQuestion || !liveTranscript.trim()) return;
    const payload: SurveyResponse = {
      questionId: currentQuestion.id,
      questionEn: currentQuestion.en,
      questionHi: currentQuestion.hi,
      askedIn: askMode,
      transcript: liveTranscript.trim(),
      confidence: liveConfidence,
      selectedOptionKey: selectedFromTranscript?.option.key,
      selectedOptionEn: selectedFromTranscript?.option.labelEn,
      selectedOptionHi: selectedFromTranscript?.option.labelHi,
      matchType: selectedFromTranscript?.matchType,
      timestamp: new Date().toISOString(),
    };
    setResponses((prev) => {
      const withoutCurrent = prev.filter((item) => item.questionId !== currentQuestion.id);
      return [...withoutCurrent, payload];
    });
  };

  const goNext = () => {
    setLiveTranscript("");
    setLiveConfidence(null);
    setError("");
    setCurrentIndex((prev) => Math.min(prev + 1, Math.max(questions.length - 1, 0)));
  };

  const goPrevious = () => {
    setLiveTranscript("");
    setLiveConfidence(null);
    setError("");
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const responseMap = useMemo(
    () => new Map(responses.map((response) => [response.questionId, response])),
    [responses],
  );
  const answeredCount = responseMap.size;

  const exportJson = () => {
    const ordered = questions
      .map((question) => responseMap.get(question.id))
      .filter((item): item is SurveyResponse => Boolean(item));
    downloadTextFile("survey_responses.json", JSON.stringify(ordered, null, 2), "application/json");
  };

  const exportCsv = () => {
    const header = [
      "question_id",
      "question_en",
      "question_hi",
      "asked_in",
      "transcript",
      "confidence",
      "selected_option_key",
      "selected_option_en",
      "selected_option_hi",
      "match_type",
      "timestamp",
    ];
    const lines = questions
      .map((question) => responseMap.get(question.id))
      .filter((item): item is SurveyResponse => Boolean(item))
      .map((item) =>
        [
          item.questionId,
          item.questionEn,
          item.questionHi,
          item.askedIn,
          item.transcript,
          item.confidence === null ? "" : item.confidence.toFixed(3),
          item.selectedOptionKey ?? "",
          item.selectedOptionEn ?? "",
          item.selectedOptionHi ?? "",
          item.matchType ?? "",
          item.timestamp,
        ]
          .map(escapeCsv)
          .join(","),
      );
    downloadTextFile(
      "survey_responses.csv",
      [header.map(escapeCsv).join(","), ...lines].join("\n"),
      "text/csv",
    );
  };

  const savedCurrent = currentQuestion ? responseMap.get(currentQuestion.id) : null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_14%_0%,color-mix(in_oklch,var(--chart-2)_18%,transparent),transparent_33%),linear-gradient(to_bottom,var(--background),color-mix(in_oklch,var(--accent)_24%,var(--background)))] px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-11 w-11 rounded-md object-contain" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Voice Survey Bot</h1>
              <p className="text-sm text-muted-foreground">Hindi + English voice interview workflow</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeftIcon className="mr-2 size-4" />
              Home
            </Button>
            <Button variant="outline" onClick={exportJson} disabled={answeredCount === 0}>
              <DownloadIcon className="mr-2 size-4" />
              Export JSON
            </Button>
            <Button onClick={exportCsv} disabled={answeredCount === 0}>
              <DownloadIcon className="mr-2 size-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Question Bank</CardTitle>
              <CardDescription>
                Add one question per line: <code>English | Hindi | optionEn/optionHi, optionEn/optionHi</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={script}
                onChange={(event) => setScript(event.target.value)}
                className="min-h-[260px] font-mono text-sm"
                placeholder="Can you read? | क्या आप पढ़ सकते हैं? | Yes/हाँ, No/नहीं"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{questions.length} questions loaded</Badge>
                <Badge variant="outline">
                  {answeredCount}/{questions.length} answered
                </Badge>
                {!canSpeak && <Badge variant="destructive">Speech synthesis not supported</Badge>}
                {!canListen && <Badge variant="destructive">Speech recognition not supported</Badge>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Interview Console</CardTitle>
              <CardDescription>Ask by voice, capture spoken response, save, move to next</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  Question {Math.min(currentIndex + 1, Math.max(questions.length, 1))} / {questions.length}
                </Badge>
                {savedCurrent && <Badge variant="secondary">Saved</Badge>}
              </div>

              <div className="rounded-xl border bg-card p-4">
                <p className="text-sm text-muted-foreground">English</p>
                <p className="mt-1 text-base font-medium">{currentQuestion?.en ?? "No questions loaded."}</p>
                <p className="mt-3 text-sm text-muted-foreground">Hindi</p>
                <p className="mt-1 text-base font-medium">{currentQuestion?.hi ?? "-"}</p>
                {currentQuestion && currentQuestion.options.length > 0 && (
                  <div className="mt-4 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Options</p>
                    <div className="flex flex-wrap gap-2">
                      {currentQuestion.options.map((option, index) => (
                        <Badge key={option.key} variant="outline">
                          {index + 1}. {option.labelEn} / {option.labelHi}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ask Mode</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={askMode === "en" ? "default" : "outline"}
                      onClick={() => setAskMode("en")}
                    >
                      English
                    </Button>
                    <Button
                      size="sm"
                      variant={askMode === "hi" ? "default" : "outline"}
                      onClick={() => setAskMode("hi")}
                    >
                      Hindi
                    </Button>
                    <Button
                      size="sm"
                      variant={askMode === "both" ? "default" : "outline"}
                      onClick={() => setAskMode("both")}
                    >
                      <LanguagesIcon className="mr-1 size-4" />
                      Both
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Listen Mode</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={listenMode === "hi-IN" ? "default" : "outline"}
                      onClick={() => setListenMode("hi-IN")}
                    >
                      Hindi
                    </Button>
                    <Button
                      size="sm"
                      variant={listenMode === "en-IN" ? "default" : "outline"}
                      onClick={() => setListenMode("en-IN")}
                    >
                      English
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={speakCurrentQuestion} disabled={!currentQuestion || !canSpeak || isSpeaking}>
                  <Volume2Icon className="mr-2 size-4" />
                  {isSpeaking ? "Speaking..." : "Speak Question"}
                </Button>
                {!isListening ? (
                  <Button variant="outline" onClick={startListening} disabled={!currentQuestion || !canListen}>
                    <MicIcon className="mr-2 size-4" />
                    Start Listening
                  </Button>
                ) : (
                  <Button variant="outline" onClick={stopListening}>
                    <PauseIcon className="mr-2 size-4" />
                    Stop Listening
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={saveCurrentResponse}
                  disabled={!liveTranscript.trim() || !currentQuestion}
                >
                  <SaveIcon className="mr-2 size-4" />
                  Save Response
                </Button>
              </div>

              <div className="rounded-xl border p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Live Transcript {isListening ? "(listening...)" : ""}
                </p>
                <p className="min-h-12 text-sm">{liveTranscript || "No speech captured yet."}</p>
                {liveConfidence !== null && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Confidence: {(liveConfidence * 100).toFixed(1)}%
                  </p>
                )}
                {selectedFromTranscript && (
                  <p className="mt-2 text-xs font-medium text-primary">
                    Detected option: {selectedFromTranscript.option.labelEn} / {selectedFromTranscript.option.labelHi}
                  </p>
                )}
              </div>

              {error && (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={goPrevious} disabled={currentIndex <= 0}>
                  <PlayIcon className="mr-2 size-4 rotate-180" />
                  Previous
                </Button>
                <Button onClick={goNext} disabled={currentIndex >= questions.length - 1}>
                  <SkipForwardIcon className="mr-2 size-4" />
                  Next Question
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
