"use client";

import { useEffect, useState } from "react";
import PublicSubscriberNote from "./PublicSubscriberNote";

export default function PublicSubscriberNoteClient({ className }: { className?: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/alerts/stats")
      .then((res) => res.json())
      .then((data: { subscribers?: number | null }) => {
        if (!cancelled && typeof data.subscribers === "number") setCount(data.subscribers);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return <PublicSubscriberNote count={count} className={className} />;
}
