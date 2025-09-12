"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Send, Loader2, AlertTriangle, MessageSquare, ThumbsUp, CheckCircle, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, doc, updateDoc, arrayUnion, arrayRemove, getDoc, runTransaction } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { suggestionFormSchema, type SuggestionFormValues, suggestionCategories, type StoredSuggestion } from "@/schemas/suggestion-schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNowStrict } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AnimatedCard } from "@/components/motion/animated-card";


// Suggestion Card Component
const SuggestionCard = ({ suggestion, onUpvote, currentUserId, delay }: { suggestion: StoredSuggestion; onUpvote: (id: string) => void; currentUserId: string | null, delay: number }) => {
    const hasUpvoted = currentUserId && suggestion.upvotes.includes(currentUserId);
    const timeAgo = formatDistanceToNowStrict(suggestion.createdAt.toDate(), { addSuffix: true });

    const getStatusBadgeVariant = (status: StoredSuggestion["status"]) => {
        switch (status) {
            case "new": return "secondary";
            case "under-review": return "outline";
            case "planned": return "default";
            case "implemented": return "success";
            case "rejected": return "destructive";
            default: return "secondary";
        }
    };

    return (
        <AnimatedCard delay={delay}>
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-md font-semibold">{suggestion.subject}</CardTitle>
                        <Badge variant={getStatusBadgeVariant(suggestion.status)} className="capitalize text-xs">{suggestion.status.replace('-', ' ')}</Badge>
                    </div>
                    <CardDescription className="text-xs pt-1">
                        Submitted {timeAgo} by {suggestion.isAnonymous ? "Anonymous User" : suggestion.userEmail}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{suggestion.details}</p>
                    <div className="flex justify-between items-center">
                        <Badge variant="outline">{suggestion.category}</Badge>
                        <Button variant={hasUpvoted ? "default" : "outline"} size="sm" onClick={() => onUpvote(suggestion.id)} disabled={!currentUserId}>
                            <ThumbsUp className="mr-2 h-4 w-4" />
                            {hasUpvoted ? "Upvoted" : "Upvote"} ({suggestion.upvoteCount})
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </AnimatedCard>
    );
};


export default function SuggestionBoxPage() {
    const { toast } = useToast();
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [suggestions, setSuggestions] = React.useState<StoredSuggestion[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = React.useState(true);
    const [sortOrder, setSortOrder] = React.useState<'createdAt' | 'upvoteCount'>('createdAt');

    const form = useForm<SuggestionFormValues>({
        resolver: zodResolver(suggestionFormSchema),
        defaultValues: {
            subject: "",
            category: "Flight Operations",
            details: "",
            isAnonymous: false,
        },
    });
    
    const fetchSuggestions = React.useCallback(async () => {
        setIsLoadingSuggestions(true);
        try {
            // We always fetch sorted by date, sorting by upvotes will be done client-side
            const q = query(collection(db, "suggestions"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const fetchedSuggestions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredSuggestion));
            setSuggestions(fetchedSuggestions);
        } catch (error) {
            console.error("Error fetching suggestions:", error);
            toast({ title: "Error", description: "Could not load suggestions.", variant: "destructive" });
        } finally {
            setIsLoadingSuggestions(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (!authLoading && user) {
            fetchSuggestions();
        } else if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router, fetchSuggestions]);

    async function onSubmit(data: SuggestionFormValues) {
        if (!user) {
            toast({ title: "Not Authenticated", description: "You must be logged in.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "suggestions"), {
                ...data,
                userId: user.uid,
                userEmail: data.isAnonymous ? null : user.email,
                status: 'new',
                upvotes: [],
                upvoteCount: 0,
                createdAt: serverTimestamp(),
            });
            toast({ title: "Suggestion Submitted!", description: "Thank you for your feedback.", action: <CheckCircle className="text-green-500"/> });
            form.reset();
            fetchSuggestions();
        } catch (error) {
            console.error("Error submitting suggestion:", error);
            toast({ title: "Submission Failed", description: "Could not save your suggestion.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleUpvote = async (suggestionId: string) => {
        if (!user) return;
        const suggestionRef = doc(db, "suggestions", suggestionId);
        
        try {
            await runTransaction(db, async (transaction) => {
                const suggestionDoc = await transaction.get(suggestionRef);
                if (!suggestionDoc.exists()) {
                    throw "Document does not exist!";
                }
                const data = suggestionDoc.data() as StoredSuggestion;
                const currentUpvotes = data.upvotes || [];
                
                let newUpvotes;
                if (currentUpvotes.includes(user.uid)) {
                    // User is removing their upvote
                    newUpvotes = currentUpvotes.filter(uid => uid !== user.uid);
                } else {
                    // User is adding an upvote
                    newUpvotes = [...currentUpvotes, user.uid];
                }

                transaction.update(suggestionRef, { 
                    upvotes: newUpvotes,
                    upvoteCount: newUpvotes.length,
                });
            });

            // Optimistic update of local state
            setSuggestions(prev => prev.map(s => {
                if (s.id === suggestionId) {
                    const hasUpvoted = s.upvotes.includes(user.uid);
                    const newUpvotes = hasUpvoted ? s.upvotes.filter(uid => uid !== user.uid) : [...s.upvotes, user.uid];
                    return { ...s, upvotes: newUpvotes, upvoteCount: newUpvotes.length };
                }
                return s;
            }));

        } catch (error) {
            console.error("Error upvoting suggestion:", error);
            toast({ title: "Error", description: "Could not process your vote.", variant: "destructive" });
        }
    };
    
    const sortedSuggestions = React.useMemo(() => {
        const sorted = [...suggestions];
        if (sortOrder === 'upvoteCount') {
            sorted.sort((a, b) => b.upvoteCount - a.upvoteCount);
        }
        // 'createdAt' is the default from Firestore fetch
        return sorted;
    }, [suggestions, sortOrder]);


    if (authLoading || (!user && !authLoading)) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <AnimatedCard>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline flex items-center gap-3">
                            <Lightbulb className="h-7 w-7 text-primary" />
                            Suggestion Box
                        </CardTitle>
                        <CardDescription>
                            Share your ideas to improve our operations, well-being, and procedures. All suggestions are valued.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </AnimatedCard>

            <Tabs defaultValue="browse">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="browse">Browse Suggestions</TabsTrigger>
                    <TabsTrigger value="submit">Submit New Idea</TabsTrigger>
                </TabsList>
                <TabsContent value="browse" className="mt-6">
                    <div className="flex justify-end mb-4">
                        <Button variant="outline" onClick={() => setSortOrder(prev => prev === 'createdAt' ? 'upvoteCount' : 'createdAt')}>
                            <ArrowUpDown className="mr-2 h-4 w-4" />
                            Sort by: {sortOrder === 'createdAt' ? 'Most Recent' : 'Most Upvoted'}
                        </Button>
                    </div>
                    {isLoadingSuggestions ? (
                        <div className="text-center py-8"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary"/></div>
                    ) : sortedSuggestions.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {sortedSuggestions.map((s, index) => <SuggestionCard key={s.id} suggestion={s} onUpvote={handleUpvote} currentUserId={user?.uid || null} delay={0.1 + index * 0.05} />)}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">No suggestions yet. Be the first!</p>
                    )}
                </TabsContent>
                <TabsContent value="submit" className="mt-6">
                    <AnimatedCard>
                        <Card>
                            <CardHeader><CardTitle>Submit Your Suggestion</CardTitle></CardHeader>
                            <CardContent>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                        <FormField control={form.control} name="category" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Category</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl>
                                                    <SelectContent>{suggestionCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="subject" render={({ field }) => (
                                            <FormItem><FormLabel>Subject</FormLabel><FormControl><Input placeholder="A short title for your idea" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="details" render={({ field }) => (
                                            <FormItem><FormLabel>Details</FormLabel><FormControl><Textarea placeholder="Explain your suggestion in detail. What is the problem and what is your proposed solution?" className="min-h-[150px]" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="isAnonymous" render={({ field }) => (
                                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                <div className="space-y-1 leading-none"><FormLabel>Submit Anonymously</FormLabel><FormDescription>If checked, your name and email will not be attached to this suggestion.</FormDescription></div>
                                            </FormItem>
                                        )} />
                                        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                                            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Submitting...</> : <><Send className="mr-2 h-4 w-4"/>Submit Idea</>}
                                        </Button>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    </AnimatedCard>
                </TabsContent>
            </Tabs>
        </div>
    );
}
