
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";

import DashboardClientPage from "@/app/dashboard-client-page";
import { TodaysScheduleCard } from "@/components/features/todays-schedule";
import { MyTrainingStatusCard } from "@/components/features/my-training-status";
import { MyRequestsStatusCard } from "@/components/features/my-requests-status";
import { TrainingProgressChart } from "@/components/features/training-progress-chart";
import { RequestsStatusChart } from "@/components/features/requests-status-chart";

const WidgetSkeleton = () => (
    <div className="p-4 border rounded-lg shadow-sm">
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-10 w-full mt-4" />
    </div>
);

const ChartSkeleton = () => (
    <div className="p-4 border rounded-lg shadow-sm">
        <Skeleton className="h-6 w-1/2 mb-4" />
        <Skeleton className="h-48 w-full" />
    </div>
);


export default function DashboardPage() {
    
  return (
    <DashboardClientPage>
      {/* The order of these children matters for the new layout */}
      <Suspense fallback={<WidgetSkeleton />}>
          <TodaysScheduleCard />
      </Suspense>
      <Suspense fallback={<WidgetSkeleton />}>
          <MyTrainingStatusCard />
      </Suspense>
      <Suspense fallback={<WidgetSkeleton />}>
          <MyRequestsStatusCard />
      </Suspense>
      <Suspense fallback={<ChartSkeleton />}>
        <TrainingProgressChart />
      </Suspense>
      <Suspense fallback={<ChartSkeleton />}>
        <RequestsStatusChart />
      </Suspense>
    </DashboardClientPage>
  );
}
