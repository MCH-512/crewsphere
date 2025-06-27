"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, query, orderBy, getDocs, doc, runTransaction, Timestamp, deleteDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNowStrict } from "date-fns";
import { ThumbsUp, ImagePlus, Loader2, Send, Trash2, AlertTriangle } from "lucide-react";
import Image from "next/image";
import { postFormSchema, type PostFormValues, type StoredPost } from "@/schemas/community-post-schema";
import { AnimatedCard } from "@/components/motion/animated-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";


export default function CrewCommunityPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [posts, setPosts] = React.useState<StoredPost[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);

    const form = useForm<PostFormValues>({
        resolver: zodResolver(postFormSchema),
        defaultValues: { content: "" },
    });

    const fetchPosts = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "communityPosts"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const fetchedPosts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredPost));
            setPosts(fetchedPosts);
        } catch (error) {
            console.error("Error fetching posts:", error);
            toast({ title: "Error", description: "Could not fetch community posts.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    const handleCreatePost = async (data: PostFormValues) => {
        if (!user) return;
        setIsSubmitting(true);
        setUploadProgress(null);

        let imageUrl: string | undefined = undefined;
        const imageFile = data.imageFile?.[0];

        if (imageFile) {
            const uniqueFileName = `${new Date().getTime()}-${imageFile.name.replace(/\s+/g, '_')}`;
            const fileStoragePath = `communityPosts/${uniqueFileName}`;
            const materialStorageRef = storageRef(storage, fileStoragePath);
            const uploadTask = uploadBytesResumable(materialStorageRef, imageFile);

            await new Promise<void>((resolve, reject) => {
                uploadTask.on(
                    "state_changed",
                    (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                    (error) => {
                        console.error("Upload failed:", error);
                        toast({ title: "Image Upload Failed", description: error.message, variant: "destructive" });
                        setIsSubmitting(false);
                        reject(error);
                    },
                    async () => {
                        imageUrl = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve();
                    }
                );
            });
            if (!imageUrl) { setIsSubmitting(false); return; }
        }

        try {
            await addDoc(collection(db, "communityPosts"), {
                userId: user.uid,
                userDisplayName: user.displayName || user.email,
                userAvatarUrl: user.photoURL || null,
                content: data.content,
                imageUrl: imageUrl,
                likes: [],
                likeCount: 0,
                createdAt: serverTimestamp(),
            });
            form.reset();
            fetchPosts();
        } catch (error) {
            console.error("Error creating post:", error);
            toast({ title: "Error", description: "Failed to create post.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
            setUploadProgress(null);
        }
    };
    
    const handleLikePost = async (postId: string) => {
        if (!user) return;
        const postRef = doc(db, "communityPosts", postId);
        try {
            await runTransaction(db, async (transaction) => {
                const postDoc = await transaction.get(postRef);
                if (!postDoc.exists()) throw "Document does not exist!";
                
                const currentLikes = postDoc.data().likes || [];
                const isLiked = currentLikes.includes(user.uid);
                const newLikes = isLiked ? currentLikes.filter((uid: string) => uid !== user.uid) : [...currentLikes, user.uid];
                
                transaction.update(postRef, { likes: newLikes, likeCount: newLikes.length });
            });
            // Optimistic update
            setPosts(prevPosts => prevPosts.map(p => {
                if (p.id === postId) {
                    const isLiked = p.likes.includes(user.uid);
                    const newLikes = isLiked ? p.likes.filter(uid => uid !== user.uid) : [...p.likes, user.uid];
                    return { ...p, likes: newLikes, likeCount: newLikes.length };
                }
                return p;
            }));
        } catch (error) {
            console.error("Error liking post:", error);
            toast({ title: "Error", description: "Could not update like.", variant: "destructive" });
        }
    };

    const handleDeletePost = async (postId: string) => {
        try {
            await deleteDoc(doc(db, "communityPosts", postId));
            toast({ title: "Post Deleted", description: "Your post has been successfully removed." });
            setPosts(posts.filter(p => p.id !== postId));
        } catch (error) {
            console.error("Error deleting post:", error);
            toast({ title: "Error", description: "Could not delete the post.", variant: "destructive" });
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Create a Post</CardTitle>
                    <CardDescription>Share an update, question, or photo with the crew.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleCreatePost)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="content"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Textarea placeholder="What's on your mind?" className="resize-none" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex justify-between items-center">
                                <FormField
                                    control={form.control}
                                    name="imageFile"
                                    render={({ field: { onChange, ...rest } }) => (
                                        <FormItem>
                                            <Button asChild variant="outline" size="sm">
                                                <label>
                                                    <ImagePlus className="mr-2 h-4 w-4"/> Add Image
                                                    <Input type="file" accept="image/*" className="hidden" onChange={(e) => onChange(e.target.files)} {...rest}/>
                                                </label>
                                            </Button>
                                            <FormMessage className="text-xs"/>
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                    Post
                                </Button>
                            </div>
                            {uploadProgress !== null && <Progress value={uploadProgress} className="w-full h-1.5 mt-2" />}
                            {form.getValues("imageFile")?.[0] && <p className="text-xs text-muted-foreground">Image selected: {form.getValues("imageFile")?.[0].name}</p>}
                        </form>
                    </Form>
                </CardContent>
            </Card>
            
            <div className="space-y-4">
                {isLoading ? (
                    <div className="text-center py-8"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary"/></div>
                ) : posts.map(post => (
                    <AnimatedCard key={post.id} className="list-item">
                        <Card>
                            <CardHeader className="flex flex-row gap-3 space-y-0">
                                <Avatar>
                                    <AvatarImage src={post.userAvatarUrl || undefined} alt={post.userDisplayName} />
                                    <AvatarFallback>{post.userDisplayName?.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{post.userDisplayName}</p>
                                            <p className="text-xs text-muted-foreground">{formatDistanceToNowStrict(post.createdAt.toDate(), { addSuffix: true })}</p>
                                        </div>
                                         {user?.uid === post.userId && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this post? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeletePost(post.id)}>Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="whitespace-pre-wrap text-sm">{post.content}</p>
                                {post.imageUrl && (
                                    <div className="mt-4 rounded-lg overflow-hidden border">
                                        <Image src={post.imageUrl} alt="Post image" width={500} height={300} className="w-full h-auto object-cover"/>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter>
                                <Button
                                    variant={post.likes.includes(user?.uid || "") ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleLikePost(post.id)}
                                    disabled={!user}
                                >
                                    <ThumbsUp className="mr-2 h-4 w-4" />
                                    Like ({post.likeCount})
                                </Button>
                            </CardFooter>
                        </Card>
                    </AnimatedCard>
                ))}
            </div>
        </div>
    );
}
