
"use client";

import * as React from "react";
import { Clock } from "lucide-react";

export function HeaderClocks() {
  const [tunisTime, setTunisTime] = React.useState<string | null>(null);
  const [utcTime, setUtcTime] = React.useState<string | null>(null);

  React.useEffect(() => {
    const updateTimes = () => {
      const now = new Date();
      setUtcTime(
        now.toLocaleTimeString("fr-TN", { // Using fr-TN for consistency, UTC is universal
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

    updateTimes(); // Initial call
    const intervalId = setInterval(updateTimes, 1000); // Update every second

    return () => clearInterval(intervalId); // Cleanup interval on component unmount
  }, []);

  return (
    <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
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
