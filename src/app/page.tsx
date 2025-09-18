
"use server";

import * as React from "react";
import placeholderImages from "@/app/lib/placeholder-images.json";
import DashboardClientPage from "@/dashboard-client-page";

// Server Components for data fetching
import { TodaysScheduleCard } from "@/components/features/todays-schedule";
import { MyTrainingStatusCard } from "@/components/features/my-training-status";
import { MyRequestsStatusCard } from "@/components/features/my-requests-status";
import { TrainingProgressChart } from "@/components/features/training-progress-chart";
import { RequestsStatusChart } from "@/components/features/requests-status-chart";
import { getDashboardHeroImage } from "@/services/dashboard-service";

export default async function DashboardPage() {
  const heroImage = await getDashboardHeroImage();

  return (
    <DashboardClientPage heroImage={heroImage}>
      {/* Pass Server Components as children to the Client Component */}
      <TodaysScheduleCard />
      <MyTrainingStatusCard />
      <MyRequestsStatusCard />
      <TrainingProgressChart />
      <RequestsStatusChart />
    </DashboardClientPage>
  );
}
