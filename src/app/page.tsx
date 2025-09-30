
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

// Zod schema for functions that take no arguments
const EmptySchema = z.object({});

export default async function DashboardPage() {
  EmptySchema.parse({}); // Zod validation
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
