"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function SupabaseTestPage() {
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    async function run() {
      // Toto zavolá Supabase Auth endpoint a overí, že kľúče a URL sedia
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setStatus("❌ Error: " + error.message);
        return;
      }
      setStatus("✅ Connected. Session: " + (data.session ? "YES" : "NO"));
    }
    run();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Supabase test</h1>
      <p>{status}</p>
    </div>
  );
}
