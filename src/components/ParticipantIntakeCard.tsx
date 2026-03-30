import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveStoredParticipantProfile, type StoredParticipantProfile } from "@/lib/assessment-api";

type ParticipantIntakeCardProps = {
  title: string;
  description: string;
  initialProfile: StoredParticipantProfile | null;
  onSave: (profile: StoredParticipantProfile) => void;
  onCancel: () => void;
};

type IntakeFormState = {
  name: string;
  age: string;
  gender: string;
  country: string;
  stateRegion: string;
  city: string;
  educationLevel: string;
  employmentStatus: string;
  householdIncomeBand: string;
};

type IntakeErrors = Partial<Record<keyof IntakeFormState, string>>;

const GENDER_OPTIONS = ["Female", "Male", "Non-binary", "Other", "Prefer not to say"];
const EDUCATION_OPTIONS = [
  "Primary or below",
  "Secondary",
  "Higher secondary",
  "Graduate",
  "Postgraduate",
  "Prefer not to say",
];
const EMPLOYMENT_OPTIONS = [
  "Employed full-time",
  "Employed part-time",
  "Self-employed",
  "Unemployed",
  "Retired",
  "Homemaker",
  "Prefer not to say",
];
const INCOME_OPTIONS = [
  "Low",
  "Lower-middle",
  "Middle",
  "Upper-middle",
  "High",
  "Prefer not to say",
];

function createFormState(profile: StoredParticipantProfile | null): IntakeFormState {
  return {
    name: profile?.name ?? "",
    age: profile?.age ? String(profile.age) : "",
    gender: profile?.gender ?? "",
    country: profile?.country ?? "",
    stateRegion: profile?.stateRegion ?? "",
    city: profile?.city ?? "",
    educationLevel: profile?.socioeconomic.educationLevel ?? "",
    employmentStatus: profile?.socioeconomic.employmentStatus ?? "",
    householdIncomeBand: profile?.socioeconomic.householdIncomeBand ?? "",
  };
}

export function ParticipantIntakeCard({
  title,
  description,
  initialProfile,
  onSave,
  onCancel,
}: ParticipantIntakeCardProps) {
  const [formState, setFormState] = useState<IntakeFormState>(() => createFormState(initialProfile));
  const [errors, setErrors] = useState<IntakeErrors>({});

  useEffect(() => {
    setFormState(createFormState(initialProfile));
  }, [initialProfile]);

  const setField = <K extends keyof IntakeFormState>(field: K, value: IntakeFormState[K]) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      return { ...prev, [field]: undefined };
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: IntakeErrors = {};
    const age = Number(formState.age);

    if (!Number.isInteger(age) || age < 0 || age > 120) {
      nextErrors.age = "Enter a valid age between 0 and 120.";
    }
    if (!formState.gender.trim()) {
      nextErrors.gender = "Gender is required.";
    }
    if (!formState.country.trim()) {
      nextErrors.country = "Country is required.";
    }
    if (!formState.stateRegion.trim()) {
      nextErrors.stateRegion = "State or region is required.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const savedProfile = saveStoredParticipantProfile({
      externalParticipantId: initialProfile?.externalParticipantId,
      name: formState.name,
      age,
      gender: formState.gender,
      country: formState.country,
      stateRegion: formState.stateRegion,
      city: formState.city,
      socioeconomic: {
        educationLevel: formState.educationLevel,
        employmentStatus: formState.employmentStatus,
        householdIncomeBand: formState.householdIncomeBand,
      },
    });

    onSave(savedProfile);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_36%),linear-gradient(to_bottom,var(--background),color-mix(in_oklch,var(--accent)_24%,var(--background)))] px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-11 w-11 rounded-md object-contain" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <Button variant="outline" onClick={onCancel}>
            <ArrowLeftIcon className="mr-2 size-4" />
            Home
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Participant Details</CardTitle>
            <CardDescription>
              These details stay in this browser and are attached to each completed assessment submission sent to the backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="participant-name">Name (optional)</Label>
                  <Input
                    id="participant-name"
                    value={formState.name}
                    onChange={(event) => setField("name", event.target.value)}
                    placeholder="Leave blank if you want to avoid collecting names"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="participant-age">Age</Label>
                  <Input
                    id="participant-age"
                    type="number"
                    min={0}
                    max={120}
                    value={formState.age}
                    onChange={(event) => setField("age", event.target.value)}
                    aria-invalid={Boolean(errors.age) || undefined}
                    placeholder="Enter age"
                  />
                  {errors.age ? <p className="text-xs text-destructive">{errors.age}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={formState.gender || undefined} onValueChange={(value) => setField("gender", value)}>
                    <SelectTrigger className="w-full" aria-invalid={Boolean(errors.gender) || undefined}>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.gender ? <p className="text-xs text-destructive">{errors.gender}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="participant-country">Country</Label>
                  <Input
                    id="participant-country"
                    value={formState.country}
                    onChange={(event) => setField("country", event.target.value)}
                    aria-invalid={Boolean(errors.country) || undefined}
                    placeholder="Enter country"
                  />
                  {errors.country ? <p className="text-xs text-destructive">{errors.country}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="participant-state">State / Region</Label>
                  <Input
                    id="participant-state"
                    value={formState.stateRegion}
                    onChange={(event) => setField("stateRegion", event.target.value)}
                    aria-invalid={Boolean(errors.stateRegion) || undefined}
                    placeholder="Enter state or region"
                  />
                  {errors.stateRegion ? <p className="text-xs text-destructive">{errors.stateRegion}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="participant-city">City (optional)</Label>
                  <Input
                    id="participant-city"
                    value={formState.city}
                    onChange={(event) => setField("city", event.target.value)}
                    placeholder="Enter city"
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-card/60 p-4">
                <div className="mb-4">
                  <h2 className="text-base font-semibold">Optional Socioeconomic Fields</h2>
                  <p className="text-sm text-muted-foreground">
                    These are stored as structured JSON in the backend so you can extend them later without changing the submission model.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Education level</Label>
                    <Select
                      value={formState.educationLevel || undefined}
                      onValueChange={(value) => setField("educationLevel", value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select education" />
                      </SelectTrigger>
                      <SelectContent>
                        {EDUCATION_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Employment status</Label>
                    <Select
                      value={formState.employmentStatus || undefined}
                      onValueChange={(value) => setField("employmentStatus", value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select employment" />
                      </SelectTrigger>
                      <SelectContent>
                        {EMPLOYMENT_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Household income band</Label>
                    <Select
                      value={formState.householdIncomeBand || undefined}
                      onValueChange={(value) => setField("householdIncomeBand", value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select income band" />
                      </SelectTrigger>
                      <SelectContent>
                        {INCOME_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button type="submit">
                  Continue
                  <ArrowRightIcon className="ml-2 size-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}