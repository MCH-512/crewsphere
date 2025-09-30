
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <Card className="w-full max-w-lg text-center shadow-lg">
        <CardHeader>
          <FileQuestion className="mx-auto h-12 w-12 text-primary" />
          <CardTitle className="mt-4 text-4xl font-bold">404 - Page Not Found</CardTitle>
          <CardDescription className="mt-2 text-lg">
            The page you are looking for does not exist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            It might have been moved, or you may have typed the address incorrectly.
          </p>
          <Button asChild className="mt-6">
            <Link href="/">Return to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
