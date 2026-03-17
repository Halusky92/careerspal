"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function CanonicalHostRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      const host = window.location.hostname;
      // Avoid touching localhost / preview domains; only canonicalize the apex production domain.
      if (host !== "careerspal.com") return;
      const target = `https://www.careerspal.com${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.replace(target);
    } catch {
      // noop
    }
  }, [pathname]);

  return null;
}

