
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Compass, Loader2, Send, ThumbsUp, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, doc, runTransaction, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { communityPostFormSchema, type CommunityPostFormValues, type StoredCommunityPost } from "@/schemas/community-post-schema";
import { formatDistanceToNowStrict } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AnimatedCard } from "@/components/motion/animated-card";

// PostCard Component
const PostCard = ({ post, onLike, currentUserId }: { post: StoredCommunityPost; onLike: (id: string) => void; currentUserId: string | null; }) => {
    const hasLiked = currentUserId && post.likes.includes(currentUserId);
    const timeAgo = post.createdAt ? formatDistanceToNowStrict(post.createdAt.toDate(), { addSuffix: true }) : "just now";
    
    // Safely get author name and fallback for avatar
    const authorName = post.authorName || post.authorEmail || "Anonymous";
    const avatarFallback = (authorName || "AN").substring(0, 2).toUpperCase();

    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-start gap-4 pb-4">
                <Avatar>
                    <AvatarImage src={post.authorPhotoURL || undefined} data-ai-hint="user portrait" />
                    <AvatarFallback>{avatarFallback}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <p className="font-semibold">{authorName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{post.authorRole || 'Crew Member'} • {timeAgo}</p>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-sm whitespace-pre-wrap">{post.content}</p>
            </CardContent>
            <CardFooter className="border-t pt-2 pb-2">
                <Button variant={hasLiked ? "default" : "ghost"} size="sm" onClick={() => onLike(post.id)} disabled={!currentUserId}>
                    <ThumbsUp className="mr-2 h-4 w-4" />
                    <span>Like ({post.likeCount})</span>
                </Button>
            </CardFooter>
        </Card>
    );
};

// Main Page Component
export default function CommunityHubPage() {
    const { toast } = useToast();
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [posts, setPosts] = React.useState<StoredCommunityPost[]>([]);
    const [isLoadingPosts, setIsLoadingPosts] = React.useState(true);

    const fetchPosts = React.useCallback(async () => {
        setIsLoadingPosts(true);
        try {
            const q = query(collection(db, "communityPosts"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const fetchedPosts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredCommunityPost));
            setPosts(fetchedPosts);
        } catch (error) {
            console.error("Error fetching posts:", error);
            toast({ title: "Error", description: "Could not load community posts.", variant: "destructive" });
        } finally {
            setIsLoadingPosts(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (!authLoading) {
            if (user) {
                fetchPosts();
            } else {
                router.push('/login');
            }
        }
    }, [user, authLoading, router, fetchPosts]);

    async function onSubmit(data: CommunityPostFormValues) {
        if (!user) {
            toast({ title: "Not Authenticated", description: "You must be logged in to post.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "communityPosts"), {
                content: data.content,
                authorId: user.uid,
                authorName: user.displayName || user.email,
                authorEmail: user.email, // Add email field for fallback
                authorRole: user.role || null,
                authorPhotoURL: user.photoURL || null,
                createdAt: serverTimestamp(),
                likes: [],
                likeCount: 0,
            });
            toast({ title: "Post Published!", description: "Your post is now live in the community hub." });
            form.reset();
            fetchPosts();
        } catch (error) {
            console.error("Error submitting post:", error);
            toast({ title: "Submission Failed", description: "Could not publish your post.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleLike = async (postId: string) => {
        if (!user) return;
        const postRef = doc(db, "communityPosts", postId);

        try {
            await runTransaction(db, async (transaction) => {
                const postDoc = await transaction.get(postRef);
                if (!postDoc.exists()) throw "Document does not exist!";
                
                const data = postDoc.data();
                const currentLikes: string[] = data.likes || [];
                const hasLiked = currentLikes.includes(user.uid);
                
                const newLikes = hasLiked ? currentLikes.filter(uid => uid !== user.uid) : [...currentLikes, user.uid];
                
                transaction.update(postRef, {
                    likes: newLikes,
                    likeCount: newLikes.length,
                });
            });

            setPosts(prevPosts => prevPosts.map(p => {
                if (p.id === postId) {
                    const hasLiked = p.likes.includes(user.uid);
                    const newLikes = hasLiked ? p.likes.filter(uid => uid !== user.uid) : [...p.likes, user.uid];
                    return { ...p, likes: newLikes, likeCount: newLikes.length };
                }
                return p;
            }));

        } catch (error) {
            console.error("Error liking post:", error);
            toast({ title: "Error", description: "Could not process your like.", variant: "destructive" });
        }
    };
    
    const form = useForm<CommunityPostFormValues>({
        resolver: zodResolver(communityPostFormSchema),
        defaultValues: { content: "" },
    });

    if (authLoading || (!user && !authLoading)) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl font-headline flex items-center gap-3">
                        <Compass className="h-7 w-7 text-primary" />
                        Community Hub
                    </CardTitle>
                    <CardDescription>
                        Share updates, ask questions, and connect with fellow crew members.
                    </CardDescription>
                </CardHeader>
            </Card>
            
            <AnimatedCard>
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg flex items-center gap-2"><MessageSquare className="h-5 w-5"/>Create a new post</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="content"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Textarea
                                                    placeholder={`What's on your mind, ${user?.displayName || 'crew member'}?`}
                                                    className="min-h-[100px] text-base"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="flex justify-end">
                                    <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                        Publish Post
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </AnimatedCard>

            <div className="space-y-4">
                {isLoadingPosts ? (
                    <div className="text-center py-8"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary"/></div>
                ) : posts.length > 0 ? (
                    posts.map((post, index) => (
                        <AnimatedCard key={post.id} delay={0.1 + index * 0.05}>
                            <PostCard post={post} onLike={handleLike} currentUserId={user?.uid || null} />
                        </AnimatedCard>
                    ))
                ) : (
                    <Card className="text-center py-12">
                        <CardContent>
                           <p className="text-muted-foreground">No posts yet. Be the first to share something!</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
