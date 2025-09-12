
"use server";

import "server-only";
import { Suspense } from "react";
import DashboardClientPage from "./dashboard-client-page";
import { MyTrainingStatusCard } from "@/components/features/my-training-status";
import { TodaysScheduleCard } from "@/components/features/todays-schedule";
import { MyRequestsStatusCard } from "@/components/features/my-requests-status";
import { TrainingProgressChart } from "@/components/features/training-progress-chart";
import { RequestsStatusChart } from "@/components/features/requests-status-chart";
import { getDashboardHeroImage } from "@/services/dashboard-service";


export default async function DashboardPage() {
    
  // Fetch only the data needed by the main layout component on the server
  const heroImage = await getDashboardHeroImage();

  return (
    <DashboardClientPage heroImage={heroImage}>
      <TodaysScheduleCard />
      <MyTrainingStatusCard />
      <MyRequestsStatusCard />
      <TrainingProgressChart />
      <RequestsStatusChart />
    </DashboardClientPage>
  );
}
