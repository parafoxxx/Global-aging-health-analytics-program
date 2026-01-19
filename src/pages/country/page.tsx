import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  ArrowLeftIcon,
  UsersIcon,
  ActivityIcon,
  HeartPulseIcon,
  UserIcon,
  PieChartIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export default function CountryPage() {
  const { country: countryParam } = useParams<{ country: string }>();
  const navigate = useNavigate();
  const country = useQuery(
    api.countries.getCountryByName,
    countryParam ? { country: decodeURIComponent(countryParam) } : "skip"
  );

  if (country === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-32 mb-8" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!country) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Country Not Found</h1>
          <p className="text-muted-foreground">
            The country you're looking for doesn't exist in our database.
          </p>
          <Button onClick={() => navigate("/")}>
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Back to Map
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-6">
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Map
        </Button>

        {/* Header Section */}
        <div className="mb-8 text-center space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">{country.country}</h1>
          <p className="text-xl text-muted-foreground">
            Health and Frailty Data
          </p>
        </div>

        {/* Primary Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Participants
              </CardTitle>
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {country.total_count.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                In study sample
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Frailty Rate
              </CardTitle>
              <ActivityIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {country.frail_percentage.toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {country.frail_count.toLocaleString()} participants
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Age</CardTitle>
              <UserIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {country.avg_age.toFixed(2)} years
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Mean participant age
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Demographics */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Gender Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Female</span>
                  <span className="text-sm font-medium">
                    {country.female_percentage.toFixed(2)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${country.female_percentage}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {country.female_count.toLocaleString()} participants
                </p>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Male</span>
                  <span className="text-sm font-medium">
                    {country.male_percentage.toFixed(2)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-chart-1"
                    style={{ width: `${country.male_percentage}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {country.male_count.toLocaleString()} participants
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comorbidity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">With Comorbidity</span>
                  <span className="text-sm font-medium">
                    {country.comorbidity_percentage.toFixed(2)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-destructive"
                    style={{ width: `${country.comorbidity_percentage}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {country.comorbidity_yes.toLocaleString()} participants
                </p>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Without Comorbidity</span>
                  <span className="text-sm font-medium">
                    {(100 - country.comorbidity_percentage).toFixed(2)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-chart-2"
                    style={{ width: `${100 - country.comorbidity_percentage}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {country.comorbidity_no.toLocaleString()} participants
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Age Groups */}
        {country.age_groups && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Age Group Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(country.age_groups).map(([ageGroup, count]) => {
                  const percentage = ((count / country.total_count) * 100).toFixed(1);
                  return (
                    <div key={ageGroup}>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">{ageGroup} years</span>
                        <span className="text-sm font-medium">{percentage}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {count.toLocaleString()} participants
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Health Ratings */}
        {country.health_ratings && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Self-Reported Health Ratings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(country.health_ratings)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([rating, count]) => {
                    const percentage = ((count / country.total_count) * 100).toFixed(1);
                    return (
                      <div key={rating}>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">{rating}</span>
                          <span className="text-sm font-medium">{percentage}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-chart-3"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {count.toLocaleString()} participants
                        </p>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Marital Status */}
        {country.marital_status && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Marital Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(country.marital_status)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([status, count]) => {
                    const percentage = ((count / country.total_count) * 100).toFixed(1);
                    return (
                      <div key={status}>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">{status}</span>
                          <span className="text-sm font-medium">{percentage}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-chart-4"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {count.toLocaleString()} participants
                        </p>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Marriage Age Categories */}
        {country.marriage_age_categories && (
          <Card>
            <CardHeader>
              <CardTitle>Marriage Age Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(country.marriage_age_categories).map(([category, count]) => {
                  const percentage = ((count / country.total_count) * 100).toFixed(1);
                  return (
                    <div key={category}>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">
                          {category === ">18" ? "Married after 18" : "Married before 18"}
                        </span>
                        <span className="text-sm font-medium">{percentage}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-chart-5"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {count.toLocaleString()} participants
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
