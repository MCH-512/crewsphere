
"use server";

import "server-only";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AdminCoursesClient } from "./courses-client";
import type { StoredCourse } from "@/schemas/course-schema";

async function getInitialCourses() {
    try {
        const q = query(collection(db, "courses"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredCourse));
    } catch (err) {
        console.error("Failed to fetch initial courses:", err);
        return [];
    }
}

export default async function AdminCoursesPage() {
    const initialCourses = await getInitialCourses();
    
    return <AdminCoursesClient initialCourses={initialCourses} />;
}
