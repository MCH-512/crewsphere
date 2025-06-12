
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Sparkles, Loader2, AlertTriangle, ShieldCheck, Leaf, Users, Star, TrendingUp,
  MessageSquare, RefreshCw, Quote, Info, Link as LinkIcon, MessageCirclePlus // Added MessageCirclePlus
} from "lucide-react";
import { generateOperationalInsights, type OperationalInsightsOutput, type IndividualInsight } from "@/ai/flows/operational-insights";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import ReactMarkdown from "react-markdown";
import { AnimatedCard } from "@/components/motion/animated-card";
import { cn } from "@/lib/utils";
import Link from "next/link"; // Added Link for actionableLink

const defaultCategoryIcons: Record<IndividualInsight['category'], React.ElementType> = {
  safety: ShieldCheck,
  wellbeing: Leaf,
  teamwork: Users,
  service: Star,
  growth: TrendingUp,
  feedback: MessageSquare,
};

const priorityStyles: Record<IndividualInsight['priority'] | 'default', { border: string; iconColor: string; badgeVariant?: "default" | "destructive" | "outline" | "secondary" }> = {
  high: { border: "border-red-500 dark:border-red-400", iconColor: "text-red-600 dark:text-red-400", badgeVariant: "destructive" },
  medium: { border: "border-yellow-500 dark:border-yellow-400", iconColor: "text-yellow-600 dark:text-yellow-400", badgeVariant: "default" },
  low: { border: "border-blue-500 dark:border-blue-400", iconColor: "text-blue-600 dark:text-blue-400", badgeVariant: "secondary" },
  default: { border: "border-gray-300 dark:border-gray-600", iconColor: "text-gray-500 dark:text-gray-400", badgeVariant: "outline" },
};

// Helper to get Lucide icon component by name
const getLucideIcon = (iconName?: string): React.ElementType | null => {
  if (!iconName) return null;
  const Icons: Record<string, React.ElementType> = { ShieldCheck, Leaf, Users, Star, TrendingUp, MessageSquare, Info, Brain };
  const NormalizedIcon = Icons[iconName] || Info; // Default to Info if not found
  return NormalizedIcon;
};


export default function InsightsPage() {
  const { user, loading: authLoading } = useAuth();
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
      const userRole = user.role || "Cabin Crew"; // Default role if not specified
      const result = await generateOperationalInsights({ userName, userRole: userRole as OperationalInsightsInput['userRole'] });
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
    if (!authLoading) { // Only fetch if auth state is resolved
        fetchInsights();
    }
  }, [fetchInsights, authLoading]);

  const handleAddPrivateNote = (insightTitle: string) => {
    toast({
        title: "Feature Coming Soon!",
        description: `The ability to add private notes for "${insightTitle}" will be available in a future update.`,
    });
  };

  const renderInsightCard = (insight: IndividualInsight, index: number) => {
    const SuggestedIcon = getLucideIcon(insight.categoryIcon);
    const IconComponent = SuggestedIcon || defaultCategoryIcons[insight.category] || Brain;
    const styles = priorityStyles[insight.priority || 'default'];

    return (
      <AnimatedCard key={index} delay={0.1 * (index + 1)}>
        <Card className={cn("shadow-md hover:shadow-lg transition-shadow border-l-4 flex flex-col h-full", styles.border)}>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <CardTitle className="text-lg font-semibold flex items-center">
                {insight.emoji && <span className="mr-2 text-xl">{insight.emoji}</span>}
                <IconComponent className={cn("mr-2 h-5 w-5 flex-shrink-0", styles.iconColor)} />
                {insight.title}
              </CardTitle>
              {insight.priority && (
                <Badge variant={styles.badgeVariant} className="capitalize text-xs h-fit">
                  {insight.priority}
                </Badge>
              )}
            </div>
            {insight.contextHint && (
                <p className="text-xs text-muted-foreground italic mt-1">{insight.contextHint}</p>
            )}
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="prose prose-sm max-w-none dark:prose-invert text-foreground/90">
              <ReactMarkdown>{insight.description}</ReactMarkdown>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row items-center gap-2 pt-3 mt-auto border-t">
            {insight.actionableLink && (
                 <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                    {insight.actionableLink.href.startsWith('/') ? (
                        <Link href={insight.actionableLink.href}>
                            <LinkIcon className="mr-2 h-4 w-4"/>{insight.actionableLink.text}
                        </Link>
                    ) : (
                        <a href={insight.actionableLink.href} target="_blank" rel="noopener noreferrer">
                            <LinkIcon className="mr-2 h-4 w-4"/>{insight.actionableLink.text}
                        </a>
                    )}
                </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => handleAddPrivateNote(insight.title)} className="w-full sm:w-auto text-muted-foreground hover:text-primary">
              <MessageCirclePlus className="mr-2 h-4 w-4" /> Add Private Note
            </Button>
          </CardFooter>
        </Card>
      </AnimatedCard>
    );
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground min-h-[calc(100vh-200px)]">
        <Loader2 className="mr-3 h-10 w-10 animate-spin text-primary" />
        <p className="mt-3 text-lg">Authenticating and preparing Kai...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AnimatedCard>
        <Card className="shadow-lg bg-gradient-to-br from-primary/10 via-background to-background">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Brain className="h-10 w-10 text-primary flex-shrink-0" />
              <div>
                <CardTitle className="text-3xl font-headline text-primary">Your AI Crew Companion: Kai</CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Personalized insights and coaching from Kai to support your day.
                </CardDescription>
              </div>
            </div>
            <Button onClick={fetchInsights} variant="outline" disabled={isLoading || !user} className="mt-2 sm:mt-0 self-start sm:self-auto">
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
          <Card className="text-center py-8 border-destructive bg-destructive/10">
            <CardContent>
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-destructive" />
              <CardTitle className="text-xl font-semibold mb-2 text-destructive-foreground">Oops! Insights Unavailable</CardTitle>
              <CardDescription className="text-destructive-foreground/90">{error}</CardDescription>
            </CardContent>
          </Card>
        </AnimatedCard>
      )}

      {!isLoading && !error && insightsData && (
        <>
          <AnimatedCard delay={0.1}>
            <Card className="shadow-md p-6 text-center bg-secondary/30">
              <h2 className="text-2xl font-semibold text-foreground">{insightsData.greeting}</h2>
              {insightsData.overallSentiment && (
                <Badge variant="default" className="mt-2 text-md px-4 py-1.5 bg-primary/80 text-primary-foreground">
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
                  <p className="text-lg italic text-accent-foreground/90 dark:text-accent-foreground">
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

      {!user && !isLoading && !authLoading && ( // Ensure auth is also not loading
           <AnimatedCard>
            <Card className="text-center py-10">
                 <CardContent>
                    <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                    <CardTitle className="text-xl">Please Log In</CardTitle>
                    <CardDescription className="mt-2">Log in to receive your personalized AI coaching insights from Kai.</CardDescription>
                     <Button asChild className="mt-4"><Link href="/login">Go to Login</Link></Button>
                 </CardContent>
            </Card>
            </AnimatedCard>
        )}
    </div>
  );
}


    