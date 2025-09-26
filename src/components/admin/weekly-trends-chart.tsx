
"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import { TrendingUp, AlertTriangle, Loader2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { type WeeklyTrendDataPoint } from "@/services/admin-dashboard-service";

const chartConfig = {
  Requests: {
    label: "User Requests",
    color: "hsl(var(--chart-1))",
  },
  Suggestions: {
    label: "Suggestions",
    color: "hsl(var(--chart-2))",
  },
  Swaps: {
    label: "Swap Requests",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;


interface WeeklyTrendsChartProps {
    initialDataPromise: Promise<WeeklyTrendDataPoint[]>;
}


export function WeeklyTrendsChart({ initialDataPromise }: WeeklyTrendsChartProps) {
    const [data, setData] = React.useState<WeeklyTrendDataPoint[] | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        initialDataPromise
            .then(setData)
            .catch(e => {
                console.error("Failed to render weekly trends chart:", e);
                Sentry.captureException(e, { tags: { component: "WeeklyTrendsChart" } });
                setError("Could not load trend data.");
            });
    }, [initialDataPromise]);

    if (error) {
        return (
             <Card className="col-span-1 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Weekly Activity Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center h-[250px] text-destructive" role="alert" aria-live="polite">
                        <AlertTriangle className="h-8 w-8 mb-2"/>
                        <p className="font-semibold">{error}</p>
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    if (!data) {
        return (
            <Card className="col-span-1 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Weekly Activity Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-[250px]">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="ml-3 text-muted-foreground">Loading trends...</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Weekly Activity Trends
        </CardTitle>
        <CardDescription>
          An overview of key user activities from the last 7 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
         {!data || data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                <p className="font-semibold">No activity data available for the last 7 days.</p>
            </div>
        ) : (
            <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                <AreaChart
                    accessibilityLayer
                    data={data}
                    margin={{ left: 12, right: 12, top: 12 }}
                >
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => value}
                    />
                     <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent indicator="dot" />}
                    />
                    <defs>
                        <linearGradient id="fillRequests" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-Requests)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--color-Requests)" stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id="fillSuggestions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-Suggestions)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--color-Suggestions)" stopOpacity={0.1} />
                        </linearGradient>
                         <linearGradient id="fillSwaps" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-Swaps)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--color-Swaps)" stopOpacity={0.1} />
                        </linearGradient>
                    </defs>
                    <Area
                        dataKey="Requests"
                        type="natural"
                        fill="url(#fillRequests)"
                        stroke="var(--color-Requests)"
                        stackId="a"
                    />
                    <Area
                        dataKey="Suggestions"
                        type="natural"
                        fill="url(#fillSuggestions)"
                        stroke="var(--color-Suggestions)"
                        stackId="a"
                    />
                     <Area
                        dataKey="Swaps"
                        type="natural"
                        fill="url(#fillSwaps)"
                        stroke="var(--color-Swaps)"
                        stackId="a"
                    />
                </AreaChart>
            </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
