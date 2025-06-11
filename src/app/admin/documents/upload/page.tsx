
// This file is no longer needed and should be deleted.
// The functionality is merged into /admin/documents/create/page.tsx
// If this file is not automatically deleted by the system, please remove it manually.
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ObsoleteDocumentUploadPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/documents/create');
  }, [router]);
  return <div>Redirecting to new document creation page...</div>;
}
