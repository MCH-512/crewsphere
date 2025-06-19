
"use client";

import * as React from "react";
import { Clock, CalendarDays } from "lucide-react"; // Added CalendarDays

export function HeaderClocks() {
  const [currentDate, setCurrentDate] = React.useState<string | null>(null);
  const [tunisTime, setTunisTime] = React.useState<string | null>(null);
  const [utcTime, setUtcTime] = React.useState<string | null>(null);

  React.useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentDate(
        now.toLocaleDateString("fr-TN", { // French locale for Tunisia for date format
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      );
      setUtcTime(
        now.toLocaleTimeString("fr-TN", {
          timeZone: "UTC",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
      setTunisTime(
        now.toLocaleTimeString("fr-TN", {
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
    <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1" title="Date Actuelle">
        <CalendarDays className="h-3.5 w-3.5" />
        <span>{currentDate || "--- -- ---"}</span>
      </div>
      <div className="flex items-center gap-1" title="Heure Locale (Tunis)">
        <Clock className="h-3.5 w-3.5" />
        <span>TUN:</span>
        <span className="font-mono">{tunisTime || "--:--:--"}</span>
      </div>
      <div className="flex items-center gap-1" title="Temps Universel Coordonné">
        <Clock className="h-3.5 w-3.5" />
        <span>UTC:</span>
        <span className="font-mono">{utcTime || "--:--:--"}</span>
      </div>
    </div>
  );
}
