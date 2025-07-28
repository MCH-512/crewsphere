"use server";

import * as React from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type StoredDocument } from "@/schemas/document-schema";
import { DocumentLibraryClient } from "./document-library-client";


async function getDocuments() {
    const q = query(collection(db, "documents"), orderBy("lastUpdated", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredDocument));
}

export default async function DocumentLibraryServerPage() {
    const initialDocuments = await getDocuments();
    return <DocumentLibraryClient initialDocuments={initialDocuments} />;
}
