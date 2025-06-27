"use client";

import * as React from "react";
import { Clock, CalendarDays } from "lucide-react";

export function HeaderClocks() {
  const [currentDate, setCurrentDate] = React.useState<string | null>(null);
  const [tunisTime, setTunisTime] = React.useState<string | null>(null);
  const [utcTime, setUtcTime] = React.useState<string | null>(null);

  React.useEffect(() => {
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

    updateDateTime(); // Initial call
    const intervalId = setInterval(updateDateTime, 1000); // Update every second

    return () => clearInterval(intervalId); // Cleanup interval on component unmount
  }, []);

  return (
    <div className="hidden md:flex items-center gap-2 text-xs font-medium text-foreground">
      <div className="flex items-center gap-2 border bg-card h-9 px-3 rounded-md" title="Current Date">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <span className="font-mono">{currentDate || "--- -- ---"}</span>
      </div>
      <div className="flex items-center gap-2 border bg-card h-9 px-3 rounded-md" title="Local Time (Tunis)">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span>TUN:</span>
        <span className="font-mono">{tunisTime || "--:--:--"}</span>
      </div>
      <div className="flex items-center gap-2 border bg-card h-9 px-3 rounded-md" title="Coordinated Universal Time">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span>UTC:</span>
        <span className="font-mono">{utcTime || "--:--:--"}</span>
      </div>
    </div>
  );
}
