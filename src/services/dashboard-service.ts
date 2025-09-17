

'use server';

import { db, isConfigValid } from "@/lib/firebase";
import { getCurrentUser } from "@/lib/session";
import { collection, getDocs, query, where, Timestamp, orderBy, limit } from "firebase/firestore";
import { startOfDay, endOfDay } from "date-fns";
import type { StoredCourse } from "@/schemas/course-schema";
import type { StoredUserQuizAttempt } from "@/schemas/user-progress-schema";
import type { StoredUserRequest } from "@/schemas/request-schema";
import type { RequestsChartDataPoint } from "@/components/features/charts/requests-status-bar-chart";
import type { TrainingChartDataPoint } from "@/components/features/charts/training-progress-pie-chart";
import { generateDashboardImage } from "@/ai/flows/generate-dashboard-image-flow";
import { getAirportByCode } from "./airport-service";
import placeholderImages from "@/app/lib/placeholder-images.json";

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

const getTimeOfDay = (): TimeOfDay => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 18) return "afternoon";
    if (hour >= 18 && hour < 22) return "evening";
    return "night";
};


export async function getDashboardHeroImage(): Promise<{ src: string; hint: string; }> {
    const defaultImage = { src: placeholderImages.dashboard.hero.src, hint: placeholderImages.dashboard.hero.hint };
    const user = await getCurrentUser();

    if (user && isConfigValid && db) {
        try {
            const now = new Date().toISOString();
            const flightsQuery = query(
                collection(db, "flights"),
                where("allCrewIds", "array-contains", user.uid),
                where("scheduledDepartureDateTimeUTC", ">=", now),
                orderBy("scheduledDepartureDateTimeUTC", "asc"),
                limit(1)
            );
            const nextFlightSnapshot = await getDocs(flightsQuery);

            if (!nextFlightSnapshot.empty) {
                const nextFlight = nextFlightSnapshot.docs[0].data();
                const destinationAirport = await getAirportByCode(nextFlight.arrivalAirport);
                const destination = destinationAirport?.city || nextFlight.arrivalAirport;
                const departureTimeOfDay = new Date(nextFlight.scheduledDepartureDateTimeUTC).getHours() < 12 ? 'sunrise' : 'daylight';
                
                const result = await generateDashboardImage({
                    destination,
                    timeOfDay: departureTimeOfDay,
                });
                
                if (result.imageDataUri) {
                    return { src: result.imageDataUri, hint: `flight to ${destination}` };
                }
            }
        } catch (error) {
            console.error("Failed to generate dynamic hero image, falling back to default:", error);
            return defaultImage;
        }
    }
    
    return defaultImage;
}

export async function getTrainingStatus(): Promise<{ totalMandatory: number; completed: number; nextCourseId?: string; } | null> {
    const user = await getCurrentUser();
    if (!user || !isConfigValid || !db) {
        return null;
    }
     try {
        const coursesQuery = query(collection(db, "courses"), where("published", "==", true), where("mandatory", "==", true), orderBy("createdAt", "asc"));
        const attemptsQuery = query(collection(db, "userQuizAttempts"), where("userId", "==", user.uid), where("status", "==", "passed"));
        
        const [coursesSnapshot, attemptsSnapshot] = await Promise.all([getDocs(coursesQuery), getDocs(attemptsQuery)]);

        const mandatoryCourses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredCourse));
        const passedCourseIds = new Set(attemptsSnapshot.docs.map(doc => (doc.data() as StoredUserQuizAttempt).courseId));
        
        const completedCount = mandatoryCourses.filter(c => passedCourseIds.has(c.id)).length;
        const outstandingCourses = mandatoryCourses.filter(c => !passedCourseIds.has(c.id));
        
        return {
            totalMandatory: mandatoryCourses.length,
            completed: completedCount,
            nextCourseId: outstandingCourses.length > 0 ? outstandingCourses[0].id : undefined
        };
    } catch(e) {
        console.error("Error fetching training status from server: ", e);
        return null;
    }
}

export async function getRequestsStatus(): Promise<{ pendingCount: number; latestRequest: { subject: string; status: string; } | null; } | null> {
    const user = await getCurrentUser();
    if (!user || !isConfigValid || !db) {
        return null;
    }

    const requestsQuery = query(
        collection(db, "requests"), 
        where("userId", "==", user.uid), 
        where("status", "in", ["pending", "in-progress"]), 
        orderBy("createdAt", "desc")
    );
    
    try {
        const querySnapshot = await getDocs(requestsQuery);
        const allUserRequests = querySnapshot.docs.map(doc => {
            const data = doc.data() as Omit<StoredUserRequest, 'id'>;
            return {
                 ...data,
            };
        });
        
        const pendingCount = allUserRequests.length;
        const latestRequest = allUserRequests.length > 0 ? { subject: allUserRequests[0].subject, status: allUserRequests[0].status } : null;

        return { pendingCount, latestRequest };
    } catch(e) {
         console.error("Error fetching request status from server:", e);
         return null;
    }
}


export async function getTrainingChartData(): Promise<TrainingChartDataPoint[] | null> {
    const user = await getCurrentUser();
    if (!user || !isConfigValid || !db) return null;
    try {
        const mandatoryCoursesQuery = query(collection(db, "courses"), where("mandatory", "==", true), where("published", "==", true));
        const attemptsQuery = query(collection(db, "userQuizAttempts"), where("userId", "==", user.uid), where("status", "==", "passed"));
        
        const [coursesSnap, attemptsSnap] = await Promise.all([getDocs(mandatoryCoursesQuery), getDocs(attemptsQuery)]);
        
        const mandatoryCoursesCount = coursesSnap.size;
        const passedCourseIds = new Set(attemptsSnap.docs.map(doc => (doc.data() as StoredUserQuizAttempt).courseId));
        const completedCount = coursesSnap.docs.filter(doc => passedCourseIds.has(doc.id)).length;
        
        return [
            { name: 'Completed', count: completedCount, fill: 'var(--color-completed)' },
            { name: 'Pending', count: mandatoryCoursesCount - completedCount, fill: 'var(--color-pending)' },
        ];
    } catch (error) {
        console.error("Error fetching training chart data:", error);
        return null;
    }
}


export async function getRequestsChartData(): Promise<RequestsChartDataPoint[] | null> {
    const user = await getCurrentUser();
    if (!user || !isConfigValid || !db) return null;
    try {
        const requestsQuery = query(collection(db, "requests"), where("userId", "==", user.uid));
        const requestsSnap = await getDocs(requestsQuery);
        const requestsByStatus = requestsSnap.docs.reduce((acc, doc) => {
            const status = doc.data().status || 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        return Object.entries(requestsByStatus).map(([status, count]) => ({
            status: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
            count,
        }));
    } catch (error) {
        console.error("Error fetching requests chart data:", error);
        return null;
    }
}

