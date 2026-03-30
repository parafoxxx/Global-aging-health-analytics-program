import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { DownloadIcon, LoaderCircleIcon, LockIcon, LogOutIcon, ShieldCheckIcon } from "lucide-react";
import * as XLSX from "xlsx";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AssessmentApiError,
  fetchAssessmentSubmissionsExport,
  loginAdmin,
  type AssessmentExportSubmission,
} from "@/lib/assessment-api";
import {
  clearAdminSession,
  ensureAdminSession,
  getStoredAdminExpiresAt,
  storeAdminSession,
} from "@/lib/admin-auth";

function toWorkbookBaseRow(submission: AssessmentExportSubmission) {
  const socioeconomic = submission.participantSocioeconomic ?? {};
  const metadata = submission.metadata ?? {};

  return {
    submission_id: submission.submissionId,
    participant_id: submission.participantId,
    participant_external_id: submission.externalParticipantId,
    participant_name: submission.participantName,
    participant_age: submission.participantAge,
    participant_gender: submission.participantGender,
    participant_country: submission.participantCountry,
    participant_state_region: submission.participantStateRegion,
    participant_city: submission.participantCity,
    education_level: socioeconomic.educationLevel ?? "",
    employment_status: socioeconomic.employmentStatus ?? "",
    household_income_band: socioeconomic.householdIncomeBand ?? "",
    assessment_type: submission.assessmentType,
    total_score: submission.totalScore ?? "",
    max_score: submission.maxScore ?? "",
    normalized_score: submission.normalizedScore ?? "",
    result_label: submission.resultLabel ?? "",
    instrument: typeof metadata.instrument === "string" ? metadata.instrument : "",
    answered_count: typeof metadata.answeredCount === "number" ? metadata.answeredCount : "",
    consented_at: typeof metadata.consentedAt === "string" ? metadata.consentedAt : "",
    submitted_at: submission.submittedAt,
  };
}

function asRecordArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

function buildFrailtySheetRows(submissions: AssessmentExportSubmission[]) {
  return submissions.map((submission) => {
    const row: Record<string, string | number> = { ...toWorkbookBaseRow(submission) };

    for (const answer of asRecordArray(submission.answers)) {
      const itemId = Number(answer.itemId);
      if (!Number.isFinite(itemId)) continue;
      const prefix = `q${String(itemId).padStart(2, "0")}`;
      row[`${prefix}_domain`] = typeof answer.domain === "string" ? answer.domain : "";
      row[`${prefix}_prompt`] = typeof answer.prompt === "string" ? answer.prompt : "";
      row[`${prefix}_selected_label`] = typeof answer.selectedLabel === "string" ? answer.selectedLabel : "";
      row[`${prefix}_selected_value`] = typeof answer.selectedValue === "number" ? answer.selectedValue : "";
      row[`${prefix}_selected_hint`] = typeof answer.selectedHint === "string" ? answer.selectedHint : "";
    }

    return row;
  });
}

function buildDepressionSheetRows(submissions: AssessmentExportSubmission[]) {
  return submissions.map((submission) => {
    const row: Record<string, string | number> = { ...toWorkbookBaseRow(submission) };

    for (const answer of asRecordArray(submission.answers)) {
      const itemId = Number(answer.itemId);
      if (!Number.isFinite(itemId)) continue;
      const prefix = `q${String(itemId).padStart(2, "0")}`;
      row[`${prefix}_prompt`] = typeof answer.prompt === "string" ? answer.prompt : "";
      row[`${prefix}_positive_symptom`] = answer.positiveSymptom === true ? "yes" : answer.positiveSymptom === false ? "no" : "";
      row[`${prefix}_selected_label`] = typeof answer.selectedLabel === "string" ? answer.selectedLabel : "";
      row[`${prefix}_selected_value`] = typeof answer.selectedValue === "number" ? answer.selectedValue : "";
      row[`${prefix}_selected_hint`] = typeof answer.selectedHint === "string" ? answer.selectedHint : "";
      row[`${prefix}_screen_score`] = typeof answer.screenScore === "number" ? answer.screenScore : "";
    }

    return row;
  });
}

function buildVoiceSurveySheetRows(submissions: AssessmentExportSubmission[]) {
  return submissions.map((submission) => {
    const row: Record<string, string | number> = { ...toWorkbookBaseRow(submission) };

    for (const answer of asRecordArray(submission.answers)) {
      const questionId = typeof answer.questionId === "string" ? answer.questionId : "";
      if (!questionId) continue;
      const prefix = questionId.toLowerCase();
      row[`${prefix}_question_en`] = typeof answer.questionEn === "string" ? answer.questionEn : "";
      row[`${prefix}_question_hi`] = typeof answer.questionHi === "string" ? answer.questionHi : "";
      row[`${prefix}_selected_option_en`] = typeof answer.selectedOptionEn === "string" ? answer.selectedOptionEn : "";
      row[`${prefix}_selected_option_hi`] = typeof answer.selectedOptionHi === "string" ? answer.selectedOptionHi : "";
      row[`${prefix}_selected_option_key`] = typeof answer.selectedOptionKey === "string" ? answer.selectedOptionKey : "";
      row[`${prefix}_transcript`] = typeof answer.transcript === "string" ? answer.transcript : "";
      row[`${prefix}_confidence`] = typeof answer.confidence === "number" ? answer.confidence : "";
      row[`${prefix}_timestamp`] = typeof answer.timestamp === "string" ? answer.timestamp : "";
    }

    return row;
  });
}

function appendSheet(workbook: XLSX.WorkBook, name: string, rows: Array<Record<string, string | number>>) {
  const sheetRows = rows.length > 0 ? rows : [{ message: `No ${name} submissions found.` }];
  const sheet = XLSX.utils.json_to_sheet(sheetRows);
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isExportingWorkbook, setIsExportingWorkbook] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    let active = true;

    void (async () => {
      const ok = await ensureAdminSession();
      if (!active) return;
      setIsAuthenticated(ok);
      setIsCheckingSession(false);
      if (ok) {
        const expiresAt = getStoredAdminExpiresAt();
        setStatusMessage(expiresAt ? `Admin session active until ${new Date(expiresAt).toLocaleString()}.` : "Admin session active.");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loginId.trim() || !password) {
      setLoginError("Login ID and password are required.");
      return;
    }

    setIsSigningIn(true);
    setLoginError("");
    setStatusMessage("");
    try {
      const session = await loginAdmin(loginId.trim(), password);
      storeAdminSession(session.token, session.expiresAt);
      setIsAuthenticated(true);
      setPassword("");
      setStatusMessage(`Admin session active until ${new Date(session.expiresAt).toLocaleString()}.`);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Failed to sign in.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = () => {
    clearAdminSession();
    setIsAuthenticated(false);
    setStatusMessage("");
    setPassword("");
    setLoginError("");
  };

  const downloadAssessmentWorkbook = async () => {
    if (isExportingWorkbook) return;

    setIsExportingWorkbook(true);
    setLoginError("");
    try {
      const { submissions } = await fetchAssessmentSubmissionsExport();
      const frailtySubmissions = submissions.filter((item) => item.assessmentType === "frailty");
      const depressionSubmissions = submissions.filter((item) => item.assessmentType === "depression");
      const voiceSurveySubmissions = submissions.filter((item) => item.assessmentType === "voice-survey");

      const workbook = XLSX.utils.book_new();
      appendSheet(workbook, "Frailty", buildFrailtySheetRows(frailtySubmissions));
      appendSheet(workbook, "Depression", buildDepressionSheetRows(depressionSubmissions));
      appendSheet(workbook, "Voice Survey", buildVoiceSurveySheetRows(voiceSurveySubmissions));

      const now = new Date();
      const timestamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
      ].join("");

      XLSX.writeFile(workbook, `gahasp_assessment_responses_${timestamp}.xlsx`);
    } catch (error) {
      const message =
        error instanceof AssessmentApiError
          ? error.status === 401
            ? "Your admin session is missing or expired. Please sign in again."
            : error.status === 404
              ? "The export endpoint is not available on the running backend yet. Restart the SQL API server, then try again."
              : error.message
          : error instanceof Error
            ? error.message
            : "Failed to export assessment responses.";

      setLoginError(message);
      if (error instanceof AssessmentApiError && error.status === 401) {
        clearAdminSession();
        setIsAuthenticated(false);
      }
    } finally {
      setIsExportingWorkbook(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_35%),linear-gradient(to_bottom,var(--background),color-mix(in_oklch,var(--accent)_22%,var(--background)))] px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-11 w-11 rounded-md object-contain" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Admin Console</h1>
              <p className="text-sm text-muted-foreground">Restricted download and backend export tools</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              Back Home
            </Button>
            {isAuthenticated ? (
              <Button variant="outline" onClick={handleLogout}>
                <LogOutIcon className="mr-2 size-4" />
                Sign Out
              </Button>
            ) : null}
          </div>
        </div>

        {isCheckingSession ? (
          <Card>
            <CardContent className="flex items-center gap-3 pt-6 text-sm text-muted-foreground">
              <LoaderCircleIcon className="size-5 animate-spin" />
              Checking admin session.
            </CardContent>
          </Card>
        ) : isAuthenticated ? (
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheckIcon className="size-5 text-primary" />
                  Admin Access Granted
                </CardTitle>
                <CardDescription>{statusMessage || "You can now access restricted export tools."}</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assessment Exports</CardTitle>
                <CardDescription>
                  Download one Excel workbook containing separate subsheets for frailty, depression, and voice survey submissions.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div className="max-w-2xl text-sm text-muted-foreground">
                  This export reads from the backend and includes participant details, scoring fields, submission metadata, and flattened response columns.
                </div>
                <Button onClick={() => void downloadAssessmentWorkbook()} disabled={isExportingWorkbook}>
                  {isExportingWorkbook ? <LoaderCircleIcon className="mr-2 size-4 animate-spin" /> : <DownloadIcon className="mr-2 size-4" />}
                  Export Responses Workbook
                </Button>
              </CardContent>
            </Card>

            {loginError ? (
              <Card className="border-destructive/40">
                <CardContent className="pt-6 text-sm text-destructive">{loginError}</CardContent>
              </Card>
            ) : null}
          </div>
        ) : (
          <Card className="mx-auto max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LockIcon className="size-5 text-muted-foreground" />
                Admin Sign In
              </CardTitle>
              <CardDescription>
                Sign in with the server-side admin login ID and password to access restricted exports.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="admin-login-id">
                    Login ID
                  </label>
                  <Input id="admin-login-id" value={loginId} onChange={(event) => setLoginId(event.target.value)} autoComplete="username" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="admin-password">
                    Password
                  </label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                {loginError ? <p className="text-sm text-destructive">{loginError}</p> : null}
                <Button type="submit" className="w-full" disabled={isSigningIn}>
                  {isSigningIn ? <LoaderCircleIcon className="mr-2 size-4 animate-spin" /> : <LockIcon className="mr-2 size-4" />}
                  Sign In
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
