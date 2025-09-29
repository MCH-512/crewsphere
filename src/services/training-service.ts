'use server';

import 'server-only';
import { db, isConfigValid } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { StoredTrainingSession } from "@/schemas/training-session-schema";
import type { User } from "@/schemas/user-schema";
import { getCurrentUser } from "@/lib/session";
import { z } from 'zod';

const EmptySchema = z.object({});

interface SessionForDisplay extends StoredTrainingSession {
    attendeeCount: number;
}

export async function getTrainingSessionsPageData(): Promise<{
    initialSessions: SessionForDisplay[];
    initialUsers: User[];
    initialUserMap: Map<string, User>;
    initialPursers: User[];
    initialPilots: User[];
    initialCabinCrew: User[];
    initialInstructors: User[];
    initialTrainees: User[];
}> {
    EmptySchema.parse({}); // Zod validation
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin' || !isConfigValid || !db) {
        console.error("Unauthorized or unconfigured attempt to fetch training session data.");
        // Return a default empty state
        return {
            initialSessions: [],
            initialUsers: [],
            initialUserMap: new Map(),
            initialPursers: [],
            initialPilots: [],
            initialCabinCrew: [],
            initialInstructors: [],
            initialTrainees: [],
        };
    }
    
    try {
        const sessionsQuery = query(collection(db, "trainingSessions"), orderBy("sessionDateTimeUTC", "desc"));
        const usersSnapshot = await getDocs(collection(db, "users"));
        const allUsersData = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
        const userMapData = new Map(allUsersData.map(u => [u.uid, u]));

        const sessionsSnapshot = await getDocs(sessionsQuery);
        const sessionsData = sessionsSnapshot.docs.map(doc => {
            const data = doc.data() as StoredTrainingSession;
            return {
                ...data,
                attendeeCount: (data.attendeeIds || []).length,
            }
        });
        
        return {
            initialSessions: sessionsData,
            initialUsers: allUsersData,
            initialUserMap: userMapData,
            initialPilots: allUsersData.filter(u => u.role === 'pilote'),
            initialPursers: allUsersData.filter(u => ['purser', 'admin', 'instructor'].includes(u.role || '') && u.role !== 'pilote'),
            initialCabinCrew: allUsersData.filter(u => u.role === 'cabin crew'),
            initialInstructors: allUsersData.filter(u => u.role === 'instructor'),
            initialTrainees: allUsersData.filter(u => u.role === 'stagiaire'),
        };
    } catch (err) {
        console.error("Failed to fetch training sessions or users:", err);
        // Return a default empty state on error
        return {
            initialSessions: [],
            initialUsers: [],
            initialUserMap: new Map(),
            initialPursers: [],
            initialPilots: [],
            initialCabinCrew: [],
            initialInstructors: [],
            initialTrainees: [],
        };
    }
}
