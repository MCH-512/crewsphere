
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

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

const getHeroImage = (timeOfDay: TimeOfDay): { src: string, hint: string } => {
    switch (timeOfDay) {
        case "morning":
            return { src: "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?q=80&w=2070&auto=format&fit=crop", hint: "sunrise over airplane wing" };
        case "afternoon":
            return { src: "https://images.unsplash.com/photo-1436891620584-46f6e5398dd8?q=80&w=2070&auto=format&fit=crop", hint: "airplane tail in the sky" };
        case "evening":
            return { src: "https://images.unsplash.com/photo-1542296332-2e4473faf563?q=80&w=1974&auto=format&fit=crop", hint: "airplane tarmac sunset" };
        case "night":
            return { src: "https://images.unsplash.com/photo-1502488339655-a30993519a79?q=80&w=1974&auto=format&fit=crop", hint: "airplane cockpit at night" };
        default:
            return { src: "https://images.unsplash.com/photo-1436891620584-46f6e5398dd8?q=80&w=2070&auto=format&fit=crop", hint: "airplane tail in the sky" };
    }
};

const getTimeOfDay = (): TimeOfDay => {
    const hour = new Date().getHours(); // Assuming server is in a reasonable timezone or UTC.
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 18) return "afternoon";
    if (hour >= 18 && hour < 22) return "evening";
    return "night";
};


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

  const timeOfDay = getTimeOfDay();
  const heroImage = getHeroImage(timeOfDay);

  return (
    <DashboardClientPage heroImage={heroImage}>
      <TodaysScheduleCard initialActivities={todayActivities} />
      <MyTrainingStatusCard initialStats={trainingStats} />
      <MyRequestsStatusCard initialStats={requestsStats} />
      <TrainingProgressChart initialData={trainingChartData} />
      <RequestsStatusChart initialData={requestsChartData} />
    </DashboardClientPage>
  );
}
