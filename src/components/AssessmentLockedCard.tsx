import { ArrowLeftIcon, LockKeyholeIcon } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ParticipantAssessmentSubmission } from "@/lib/assessment-api";

type AssessmentLockedCardProps = {
  title: string;
  description: string;
  submission: ParticipantAssessmentSubmission;
  onHome: () => void;
};

function formatSubmittedAt(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function AssessmentLockedCard({ title, description, submission, onHome }: AssessmentLockedCardProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_36%),linear-gradient(to_bottom,var(--background),color-mix(in_oklch,var(--accent)_24%,var(--background)))] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-11 w-11 rounded-md object-contain" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <Button variant="outline" onClick={onHome}>
            <ArrowLeftIcon className="mr-2 size-4" />
            Home
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyholeIcon className="size-5 text-muted-foreground" />
              Submission Locked
            </CardTitle>
            <CardDescription>
              This participant has already submitted this assessment. A second attempt is blocked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-card/70 p-4 text-sm text-muted-foreground">
              <p>
                Submitted on <span className="font-medium text-foreground">{formatSubmittedAt(submission.submittedAt)}</span>
              </p>
              {submission.resultLabel ? (
                <p className="mt-2">
                  Stored result label: <span className="font-medium text-foreground">{submission.resultLabel}</span>
                </p>
              ) : null}
            </div>

            <p className="rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
              This lock is enforced in the backend for the saved participant id, so refreshing the page will not reopen the test.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}