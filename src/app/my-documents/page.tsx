
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, AlertTriangle, CalendarX, CalendarClock, CalendarCheck2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { StoredUserDocument } from "@/schemas/user-document-schema";
import { AnimatedCard } from "@/components/motion/animated-card";
import { cn } from "@/lib/utils";

const EXPIRY_WARNING_DAYS = 30;

type DocumentStatus = 'valid' | 'expiring-soon' | 'expired';

const getDocumentStatus = (expiryDate: Date): DocumentStatus => {
    const today = new Date();
    const daysUntilExpiry = differenceInDays(expiryDate, today);

    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) return 'expiring-soon';
    return 'valid';
};

const statusConfig: Record<DocumentStatus, { icon: React.ElementType, color: string, label: string }> = {
    expired: { icon: CalendarX, color: "text-destructive", label: "Expired" },
    'expiring-soon': { icon: CalendarClock, color: "text-yellow-600", label: "Expiring Soon" },
    valid: { icon: CalendarCheck2, color: "text-green-600", label: "Valid" },
};

export default function MyDocumentsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [documents, setDocuments] = React.useState<StoredUserDocument[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        const fetchDocuments = async () => {
            setIsLoading(true);
            try {
                const q = query(
                    collection(db, "userDocuments"),
                    where("userId", "==", user.uid),
                    orderBy("expiryDate", "asc")
                );
                const querySnapshot = await getDocs(q);
                const fetchedDocs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredUserDocument));
                setDocuments(fetchedDocs);
            } catch (error) {
                console.error("Error fetching documents:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDocuments();
    }, [user, authLoading, router]);

    if (authLoading || isLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    if (!user) {
      return null;
    }

    return (
        <div className="space-y-6">
            <AnimatedCard>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline flex items-center">
                            <ShieldCheck className="mr-3 h-7 w-7 text-primary" />
                            My Documents & Licenses
                        </CardTitle>
                        <CardDescription>
                            Here is the status of your official documents. Please contact administration for any updates.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </AnimatedCard>

            {documents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {documents.map((docItem, index) => {
                        const expiryDate = docItem.expiryDate.toDate();
                        const status = getDocumentStatus(expiryDate);
                        const daysDiff = differenceInDays(expiryDate, new Date());
                        const config = statusConfig[status];
                        const Icon = config.icon;
                        
                        return (
                            <AnimatedCard key={docItem.id} delay={0.1 + index * 0.05}>
                                <Card className="shadow-sm h-full flex flex-col hover:shadow-md transition-shadow">
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-start gap-3">
                                            <Icon className={cn("h-6 w-6 mt-1 flex-shrink-0", config.color)} />
                                            <span>{docItem.documentName}</span>
                                        </CardTitle>
                                        <CardDescription>{docItem.documentType}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow space-y-2 text-sm">
                                        <p><strong>Expiry Date:</strong> {format(expiryDate, "PPP")}</p>
                                        <p><strong>Status:</strong> <span className={cn("font-semibold", config.color)}>{config.label}</span></p>
                                        {status === 'expiring-soon' && <p className="text-yellow-700">Expires in {daysDiff} days.</p>}
                                        {status === 'expired' && <p className="text-destructive">Expired {Math.abs(daysDiff)} days ago.</p>}
                                        {docItem.notes && <p className="text-xs text-muted-foreground pt-2 border-t mt-2"><strong>Notes:</strong> {docItem.notes}</p>}
                                    </CardContent>
                                    <CardFooter>
                                        <p className="text-xs text-muted-foreground">Issued: {format(docItem.issueDate.toDate(), "PP")}</p>
                                    </CardFooter>
                                </Card>
                            </AnimatedCard>
                        )
                    })}
                </div>
            ) : (
                 <AnimatedCard delay={0.1}>
                    <Card className="text-center py-12">
                        <CardContent>
                           <p className="text-muted-foreground">No documents are currently being tracked for you.</p>
                           <p className="text-xs text-muted-foreground mt-1">Please contact an administrator to add your documents.</p>
                        </CardContent>
                    </Card>
                </AnimatedCard>
            )}
        </div>
    );
}
