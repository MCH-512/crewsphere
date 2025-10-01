"use client";

import * as React from "react";
import { Clock, CalendarDays } from "lucide-react";

export function HeaderClocks() {
  const [isClient, setIsClient] = React.useState(false);
  const [currentDate, setCurrentDate] = React.useState("");
  const [tunisTime, setTunisTime] = React.useState("");
  const [utcTime, setUtcTime] = React.useState("");

  React.useEffect(() => {
    // This effect runs only on the client, after the initial render.
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    // This effect only runs on the client, because isClient is false on the server.
    if (!isClient) return;

    const updateDateTime = () => {
      const now = new Date();
      setCurrentDate(
        now.toLocaleDateString("en-US", {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      );
      setUtcTime(
        now.toLocaleTimeString("en-GB", {
          timeZone: "UTC",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
      setTunisTime(
        now.toLocaleTimeString("en-GB", {
          timeZone: "Africa/Tunis",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };

    updateDateTime(); // Run once immediately on the client
    const intervalId = setInterval(updateDateTime, 1000);

    return () => clearInterval(intervalId); // Cleanup interval on unmount
  }, [isClient]);

  // On the server, and on the first client render, show placeholders.
  // This ensures the server-rendered HTML matches the initial client render, preventing hydration errors.
  return (
    <div className="hidden md:flex items-center gap-2 text-xs font-medium text-foreground">
      <div className="flex items-center gap-2 border bg-card h-9 px-3 rounded-md" title="Current Date">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <span className="font-mono">{isClient ? currentDate : "--- -- ---"}</span>
      </div>
      <div className="flex items-center gap-2 border bg-card h-9 px-3 rounded-md" title="Local Time (Tunis)">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span>TUN:</span>
        <span className="font-mono">{isClient ? tunisTime : "--:--:--"}</span>
      </div>
      <div className="flex items-center gap-2 border bg-card h-9 px-3 rounded-md" title="Coordinated Universal Time">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span>UTC:</span>
        <span className="font-mono">{isClient ? utcTime : "--:--:--"}</span>
      </div>
    </div>
  );
}
