
"use server";

import "server-only";
import { DocumentValidationsClient } from "./document-validations-client";
import { getDocumentsForValidation } from "@/services/document-service";


export default async function AdminDocumentValidationPage() {
    const initialDocuments = await getDocumentsForValidation();
    
    return <DocumentValidationsClient initialDocuments={initialDocuments} />;
}
