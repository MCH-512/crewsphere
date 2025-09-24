
"use server";

import "server-only";
import { AdminCoursesClient } from "./courses-client";
import { getDocs, collection, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { StoredCourse } from "@/schemas/course-schema";
import { z } from "zod";

const EmptySchema = z.object({});

async function getInitialCourses(): Promise<StoredCourse[]> {
    try {
        const q = query(collection(db, "courses"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredCourse));
    } catch (error) {
        console.error("Failed to fetch initial courses:", error);
        return [];
    }
}


export default async function AdminCoursesPage() {
    EmptySchema.parse({}); // Zod validation
    const initialCourses = await getInitialCourses();
    
    return <AdminCoursesClient initialCourses={initialCourses} />;
}
