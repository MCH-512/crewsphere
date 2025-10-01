'use server';

import 'server-only';
import { db, isConfigValid } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import type { StoredUserDocument } from "@/schemas/user-document-schema";
import { getCurrentUser } from "@/lib/session";
import { z } from 'zod';

const EmptySchema = z.object({});


/**
 * Fetches all user documents for the validation page.
 * This is a server-only function intended for admin use.
 * @returns A promise that resolves to an array of StoredUserDocument.
 */
export async function getDocumentsForValidation(): Promise<StoredUserDocument[]> {
    EmptySchema.parse({}); // Validate input
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin' || !isConfigValid || !db) {
        console.error("Unauthorized or unconfigured attempt to fetch documents for validation.");
        return [];
    }

    try {
        const docsQuery = query(collection(db, "userDocuments"), orderBy("lastUpdatedAt", "desc"));
        const docsSnapshot = await getDocs(docsQuery);
        return docsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredUserDocument));
    } catch (err) {
        console.error("Error fetching documents for validation:", err);
        return [];
    }
}
