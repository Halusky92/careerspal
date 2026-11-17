"use client";

import { useEffect } from "react";

const OFFSET = 80;

export default function HashScroll() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest?.("a");
      if (!link) return;
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("#") || href.length < 2) return;
      const target = document.getElementById(decodeURIComponent(href.slice(1)));
      if (!target) return;
      event.preventDefault();
      const top = window.scrollY + target.getBoundingClientRect().top - OFFSET;
      window.scrollTo({ top: Math.max(0, top), left: window.scrollX });
      history.pushState(null, "", href);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
