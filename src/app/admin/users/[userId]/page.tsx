
"use server";
import 'server-only';

import * as React from "react";
import { notFound } from "next/navigation";
import { getUserProfileData } from "@/services/user-profile-service";
import { UserDetailClient } from "./user-detail-client";

export default async function UserDetailPage({ params }: { params: { userId: string } }) {
    const { userId } = params;
    const initialProfileData = await getUserProfileData(userId);

    if (!initialProfileData) {
        notFound();
    }
    
    return <UserDetailClient initialProfileData={initialProfileData} />;
}
