
"use server";

import "server-only";
import AdminCoursesPage from "@/admin/courses/page";

export default async function AdminCoursesPageWrapper() {
    return <AdminCoursesPage />;
}
