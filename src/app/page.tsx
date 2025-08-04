import * as React from "react";
import DashboardClientPage from "@/app/dashboard-client-page";
import { MyTrainingStatusCard } from "@/components/features/my-training-status";
import { MyRequestsStatusCard } from "@/components/features/my-requests-status";
import { TodaysScheduleCard } from "@/components/features/todays-schedule";
import { TrainingProgressChart } from "@/components/features/training-progress-chart";
import { RequestsStatusChart } from "@/components/features/requests-status-chart";

export default function DashboardPage() {
    
  return (
    <DashboardClientPage>
      {/* The order of these children matters for the layout */}
      <TodaysScheduleCard />
      <MyTrainingStatusCard />
      <MyRequestsStatusCard />
      <TrainingProgressChart />
      <RequestsStatusChart />
    </DashboardClientPage>
  );
}
