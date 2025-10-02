
import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
       <div className="flex items-center text-lg text-muted-foreground">
        <Loader2 className="mr-3 h-6 w-6 animate-spin text-primary" />
        Loading...
      </div>
    </div>
  );
}
