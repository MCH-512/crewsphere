
'use server';

import "server-only";
import { DocumentValidationsClient } from "./document-validations-client";
import { getDocumentsForValidation } from "@/services/document-service";
import { z } from "zod";

const EmptySchema = z.object({});

export default async function AdminDocumentValidationPage() {
    EmptySchema.parse({}); // Zod validation
    const initialDocuments = await getDocumentsForValidation();
    
    return <DocumentValidationsClient initialDocuments={initialDocuments} />;
}
