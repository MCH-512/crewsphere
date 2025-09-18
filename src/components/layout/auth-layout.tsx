import Image from "next/image";
import { Plane } from "lucide-react";

interface AuthLayoutProps {
    title: string;
    description: string;
    imageUrl: string;
    imageHint: string;
    children: React.ReactNode;
}

export function AuthLayout({ title, description, imageUrl, imageHint, children }: AuthLayoutProps) {
    return (
        <div className="w-full lg:grid lg:min-h-[100vh] lg:grid-cols-2 xl:min-h-[100vh]">
            <div className="flex items-center justify-center py-12">
                <div className="mx-auto grid w-[350px] gap-6">
                    <div className="grid gap-2 text-center">
                        <Plane className="mx-auto h-10 w-10 text-primary mb-2" />
                        <h1 className="text-3xl font-bold">{title}</h1>
                        <p className="text-balance text-muted-foreground">{description}</p>
                    </div>
                    {children}
                </div>
            </div>
            <div className="hidden bg-muted lg:block relative">
                <Image
                    src={imageUrl}
                    alt="Authentication page background image"
                    data-ai-hint={imageHint}
                    fill
                    className="h-full w-full object-cover dark:brightness-[0.3] dark:grayscale"
                    priority
                />
            </div>
        </div>
    );
}
