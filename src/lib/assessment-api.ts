import { useQuery as useReactQuery } from "@tanstack/react-query";

export type AssessmentType = "depression" | "frailty" | "voice-survey";

export type ParticipantSocioeconomic = {
  educationLevel: string;
  employmentStatus: string;
  householdIncomeBand: string;
};

export type StoredParticipantProfile = {
  externalParticipantId: string;
  name: string;
  age: number;
  gender: string;
  country: string;
  stateRegion: string;
  city: string;
  socioeconomic: ParticipantSocioeconomic;
};

export type AssessmentSubmissionPayload = {
  participant: StoredParticipantProfile;
  assessment: {
    type: AssessmentType;
    totalScore: number | null;
    maxScore: number | null;
    normalizedScore: number | null;
    resultLabel: string | null;
    answers: unknown;
    metadata?: Record<string, unknown>;
  };
};

export type AudioTranscriptionPayload = {
  audioBase64: string;
  mimeType: string;
  language?: string;
};

type ParticipantProfileDraft = Partial<Omit<StoredParticipantProfile, "age" | "socioeconomic">> & {
  age?: number | string;
  socioeconomic?: Partial<ParticipantSocioeconomic>;
};

const PARTICIPANT_PROFILE_STORAGE_KEY = "gahasp_participant_profile_v1";

function resolveSqlApiBaseUrl() {
  const configured = import.meta.env.VITE_SQL_API_BASE_URL?.trim();
  if (configured) {
    return configured;
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:4000`;
  }

  return "http://localhost:4000";
}

const SQL_API_BASE = resolveSqlApiBaseUrl();

export type ParticipantAssessmentSubmission = {
  submissionId: number;
  assessmentType: AssessmentType;
  resultLabel: string | null;
  submittedAt: string;
};

export type AssessmentExportSubmission = {
  submissionId: number;
  participantId: number;
  externalParticipantId: string;
  participantName: string;
  participantAge: number;
  participantGender: string;
  participantCountry: string;
  participantStateRegion: string;
  participantCity: string;
  participantSocioeconomic: Partial<ParticipantSocioeconomic>;
  assessmentType: AssessmentType;
  totalScore: number | null;
  maxScore: number | null;
  normalizedScore: number | null;
  resultLabel: string | null;
  answers: unknown;
  metadata: Record<string, unknown>;
  submittedAt: string;
};

export type AdminLoginResponse = {
  token: string;
  expiresAt: string;
};

export class AssessmentApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "AssessmentApiError";
    this.status = status;
    this.data = data;
  }
}

function createParticipantId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `participant-${Date.now()}`;
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeSocioeconomic(value: Partial<ParticipantSocioeconomic> | undefined): ParticipantSocioeconomic {
  return {
    educationLevel: normalizeText(value?.educationLevel),
    employmentStatus: normalizeText(value?.employmentStatus),
    householdIncomeBand: normalizeText(value?.householdIncomeBand),
  };
}

function normalizeAge(value: unknown) {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : NaN;
}

function normalizeStoredParticipantProfile(value: ParticipantProfileDraft | null | undefined): StoredParticipantProfile | null {
  if (!value) return null;

  const age = normalizeAge(value.age);
  const externalParticipantId = normalizeText(value.externalParticipantId) || createParticipantId();
  const gender = normalizeText(value.gender);
  const country = normalizeText(value.country);
  const stateRegion = normalizeText(value.stateRegion);

  if (!Number.isInteger(age) || age < 0 || age > 120 || !gender || !country || !stateRegion) {
    return null;
  }

  return {
    externalParticipantId,
    name: normalizeText(value.name),
    age,
    gender,
    country,
    stateRegion,
    city: normalizeText(value.city),
    socioeconomic: normalizeSocioeconomic(value.socioeconomic),
  };
}

export function getStoredParticipantProfile() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(PARTICIPANT_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return normalizeStoredParticipantProfile(JSON.parse(raw) as ParticipantProfileDraft);
  } catch {
    return null;
  }
}

export function saveStoredParticipantProfile(profile: ParticipantProfileDraft) {
  const normalized = normalizeStoredParticipantProfile(profile);
  if (!normalized) {
    throw new Error("Participant profile is incomplete.");
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(PARTICIPANT_PROFILE_STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
}

async function parseApiResponseError(response: Response) {
  const errorBody = await response.json().catch(() => null);
  throw new AssessmentApiError(
    errorBody?.message ?? `Request failed (${response.status})`,
    response.status,
    errorBody,
  );
}

async function getParticipantSubmissionStatuses(externalParticipantId: string): Promise<ParticipantAssessmentSubmission[]> {
  const response = await fetch(`${SQL_API_BASE}/api/participants/${encodeURIComponent(externalParticipantId)}/submissions`);

  if (!response.ok) {
    await parseApiResponseError(response);
  }

  return response.json();
}

export function useParticipantSubmissionStatuses(externalParticipantId: string | undefined) {
  return useReactQuery({
    queryKey: ["participant-submission-statuses", externalParticipantId],
    queryFn: () => getParticipantSubmissionStatuses(externalParticipantId ?? ""),
    enabled: Boolean(externalParticipantId),
    staleTime: 30_000,
  });
}

export async function submitAssessmentSubmission(payload: AssessmentSubmissionPayload) {
  const response = await fetch(`${SQL_API_BASE}/api/assessment-submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseApiResponseError(response);
  }

  return (await response.json()) as {
    submissionId: number;
    participantId: number;
    participantExternalId: string;
    submittedAt: string;
  };
}

export async function transcribeAudio(payload: AudioTranscriptionPayload) {
  const response = await fetch(`${SQL_API_BASE}/api/transcriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseApiResponseError(response);
  }

  return (await response.json()) as {
    text: string;
    model: string;
    language: string | null;
  };
}

export async function fetchAssessmentSubmissionsExport() {
  const adminToken =
    typeof window !== "undefined" ? window.localStorage.getItem("gahasp_admin_token") ?? "" : "";

  const response = await fetch(`${SQL_API_BASE}/api/assessment-submissions/export`, {
    headers: adminToken
      ? {
          Authorization: `Bearer ${adminToken}`,
        }
      : {},
  });

  if (!response.ok) {
    await parseApiResponseError(response);
  }

  return (await response.json()) as {
    submissions: AssessmentExportSubmission[];
  };
}

export async function loginAdmin(loginId: string, password: string) {
  const response = await fetch(`${SQL_API_BASE}/api/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ loginId, password }),
  });

  if (!response.ok) {
    await parseApiResponseError(response);
  }

  return (await response.json()) as AdminLoginResponse;
}

export async function validateAdminSession(token: string) {
  const response = await fetch(`${SQL_API_BASE}/api/admin/session`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseApiResponseError(response);
  }

  return (await response.json()) as {
    ok: true;
    expiresAt: string;
  };
}
