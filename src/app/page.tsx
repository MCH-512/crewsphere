
"use server";

import "server-only";
import { Suspense } from "react";
import DashboardClientPage from "./dashboard-client-page";
import { MyTrainingStatusCard } from "@/components/features/my-training-status";
import { TodaysScheduleCard } from "@/components/features/todays-schedule";
import { MyRequestsStatusCard } from "@/components/features/my-requests-status";
import { TrainingProgressChart } from "@/components/features/training-progress-chart";
import { RequestsStatusChart } from "@/components/features/requests-status-chart";

import { getTodayActivities, getTrainingStatus, getRequestsStatus, getTrainingChartData, getRequestsChartData } from "@/services/dashboard-service";

export default async function DashboardPage() {
    
  // Fetch all data for the dashboard on the server in parallel
  const [
    todayActivities,
    trainingStats,
    requestsStats,
    trainingChartData,
    requestsChartData
  ] = await Promise.all([
    getTodayActivities(),
    getTrainingStatus(),
    getRequestsStatus(),
    getTrainingChartData(),
    getRequestsChartData()
  ]);

  return (
    <DashboardClientPage>
      <TodaysScheduleCard initialActivities={todayActivities} />
      <MyTrainingStatusCard initialStats={trainingStats} />
      <MyRequestsStatusCard initialStats={requestsStats} />
      <TrainingProgressChart initialData={trainingChartData} />
      <RequestsStatusChart initialData={requestsChartData} />
    </DashboardClientPage>
  );
}
