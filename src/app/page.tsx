
import * as React from "react";
import DashboardClientPage from "@/dashboard-client-page";

// Server Components for data fetching
import { TodaysScheduleCard } from "@/components/features/todays-schedule";
import { MyTrainingStatusCard } from "@/components/features/my-training-status";
import { MyRequestsStatusCard } from "@/components/features/my-requests-status";
import { TrainingProgressChart } from "@/components/features/training-progress-chart";
import { RequestsStatusChart } from "@/components/features/requests-status-chart";
import { getDashboardHeroImage } from "@/services/dashboard-service";
import { z } from 'zod';
import { Suspense } from "react";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Zod schema for functions that take no arguments
const EmptySchema = z.object({});

const WidgetSkeleton = () => (
  <Card className="h-full shadow-md">
    <CardHeader>
      <Skeleton className="h-5 w-2/4 mb-2" />
      <Skeleton className="h-4 w-3/4" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-10 w-full" />
    </CardContent>
    <CardFooter>
      <Skeleton className="h-9 w-full" />
    </CardFooter>
  </Card>
);

const ChartSkeleton = () => (
  <Card className="h-full shadow-sm">
    <CardHeader>
      <Skeleton className="h-5 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2" />
    </CardHeader>
    <CardContent>
      <div className="flex items-center justify-center h-[250px]">
        <Skeleton className="h-48 w-48 rounded-full" />
      </div>
    </CardContent>
  </Card>
);


export default async function DashboardPage() {
  EmptySchema.parse({}); // Zod validation
  const heroImage = await getDashboardHeroImage();

  return (
    <DashboardClientPage heroImage={heroImage}>
       <AnimatedCard delay={0.1} className="lg:col-span-1">
          <Suspense fallback={<WidgetSkeleton />}>
            <TodaysScheduleCard />
          </Suspense>
       </AnimatedCard>
       
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatedCard delay={0.15}>
          <Suspense fallback={<WidgetSkeleton />}>
            <MyTrainingStatusCard />
          </Suspense>
        </AnimatedCard>
        <AnimatedCard delay={0.2}>
          <Suspense fallback={<WidgetSkeleton />}>
            <MyRequestsStatusCard />
          </Suspense>
        </AnimatedCard>
      </div>

       <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
         <AnimatedCard delay={0.3}>
           <Suspense fallback={<ChartSkeleton />}>
            <TrainingProgressChart />
          </Suspense>
        </AnimatedCard>
         <AnimatedCard delay={0.35}>
           <Suspense fallback={<ChartSkeleton />}>
            <RequestsStatusChart />
          </Suspense>
        </AnimatedCard>
      </div>
    </DashboardClientPage>
  );
}
