
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Sparkles, Loader2, AlertTriangle, ShieldCheck, Leaf, Users, Star, TrendingUp, MessageSquare, RefreshCw, Quote } from "lucide-react";
import { generateOperationalInsights, type OperationalInsightsOutput, type IndividualInsight } from "@/ai/flows/operational-insights";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import ReactMarkdown from "react-markdown";
import { AnimatedCard } from "@/components/motion/animated-card";
import { cn } from "@/lib/utils";

const categoryIcons: Record<IndividualInsight['category'], React.ElementType> = {
  safety: ShieldCheck,
  wellbeing: Leaf,
  teamwork: Users,
  service: Star,
  growth: TrendingUp,
  feedback: MessageSquare,
};

const categoryColors: Record<IndividualInsight['category'], string> = {
  safety: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400",
  wellbeing: "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400",
  teamwork: "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  service: "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  growth: "border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-400",
  feedback: "border-indigo-500/50 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
};

export default function InsightsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [insightsData, setInsightsData] = React.useState<OperationalInsightsOutput | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchInsights = React.useCallback(async () => {
    if (!user) {
      setError("Please log in to view your personalized insights.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const userName = user.displayName || user.email || "Crew Member";
      const result = await generateOperationalInsights({ userName });
      setInsightsData(result);
    } catch (apiError) {
      console.error("Error generating insights:", apiError);
      const errorMessage = apiError instanceof Error ? apiError.message : "An unknown error occurred.";
      setError(`Kai, your AI coach, is currently unavailable: ${errorMessage}`);
      toast({
        title: "Insights Error",
        description: `Could not load insights: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const renderInsightCard = (insight: IndividualInsight, index: number) => {
    const IconComponent = categoryIcons[insight.category] || Brain;
    const cardColorClass = categoryColors[insight.category] || "border-gray-500/50 bg-gray-500/10 text-gray-700 dark:text-gray-400";

    return (
      <AnimatedCard key={index} delay={0.1 * (index + 1)}>
        <Card className={cn("shadow-md hover:shadow-lg transition-shadow border-l-4", cardColorClass)}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center">
              {insight.emoji && <span className="mr-2 text-xl">{insight.emoji}</span>}
              <IconComponent className="mr-2 h-5 w-5 flex-shrink-0" />
              {insight.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert text-foreground/90">
              <ReactMarkdown>{insight.description}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      </AnimatedCard>
    );
  };

  return (
    <div className="space-y-8">
      <AnimatedCard>
        <Card className="shadow-lg bg-gradient-to-br from-primary/10 via-background to-background">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Brain className="h-10 w-10 text-primary flex-shrink-0" />
              <div>
                <CardTitle className="text-3xl font-headline text-primary">Your AI Crew Companion</CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Personalized insights and coaching from Kai to support your day.
                </CardDescription>
              </div>
            </div>
            <Button onClick={fetchInsights} variant="outline" disabled={isLoading} className="mt-2 sm:mt-0 self-start sm:self-auto">
              <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
              {isLoading ? "Refreshing..." : "Refresh Insights"}
            </Button>
          </CardHeader>
        </Card>
      </AnimatedCard>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-3 h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-lg">Kai is preparing your insights... Please wait.</p>
        </div>
      )}

      {error && !isLoading && (
        <AnimatedCard>
          <Alert variant="destructive" className="text-center py-8">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3" />
            <AlertTitle className="text-xl font-semibold mb-2">Oops! Insights Unavailable</AlertTitle>
            <CardDescription>{error}</CardDescription>
          </Alert>
        </AnimatedCard>
      )}

      {!isLoading && !error && insightsData && (
        <>
          <AnimatedCard delay={0.1}>
            <Card className="shadow-md p-6 text-center bg-secondary/30">
              <h2 className="text-2xl font-semibold text-foreground">{insightsData.greeting}</h2>
              {insightsData.overallSentiment && (
                <Badge variant="default" className="mt-2 text-md px-4 py-1.5">
                  <Sparkles className="mr-2 h-5 w-5" />
                  {insightsData.overallSentiment}
                </Badge>
              )}
            </Card>
          </AnimatedCard>

          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {insightsData.insights.map(renderInsightCard)}
          </div>

          {insightsData.motivationalQuote && (
            <AnimatedCard delay={0.1 * (insightsData.insights.length + 1)}>
              <Card className="shadow-sm border-t-4 border-accent bg-accent/10">
                <CardContent className="p-6 text-center">
                  <Quote className="h-8 w-8 text-accent mx-auto mb-3 opacity-70" />
                  <p className="text-lg italic text-accent-foreground/90">
                    &quot;{insightsData.motivationalQuote.quote}&quot;
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">- {insightsData.motivationalQuote.author}</p>
                </CardContent>
              </Card>
            </AnimatedCard>
          )}
        </>
      )}
      
      {!isLoading && !error && !insightsData && user && (
         <AnimatedCard>
          <Card className="text-center py-10">
            <CardContent>
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <CardTitle className="text-xl">No Insights Yet</CardTitle>
              <CardDescription className="mt-2">Kai is working on generating your first set of insights. Check back soon!</CardDescription>
            </CardContent>
          </Card>
        </AnimatedCard>
      )}

      {!user && !isLoading && (
           <AnimatedCard>
            <Card className="text-center py-10">
                 <CardContent>
                    <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                    <CardTitle className="text-xl">Please Log In</CardTitle>
                    <CardDescription className="mt-2">Log in to receive your personalized AI coaching insights from Kai.</CardDescription>
                     <Button asChild className="mt-4"><a href="/login">Go to Login</a></Button>
                 </CardContent>
            </Card>
            </AnimatedCard>
        )}
    </div>
  );
}
