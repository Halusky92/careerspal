"use client";

import { useEffect, useState } from "react";
import { authFetch } from "../lib/authFetch";

type AccessRequest = {
  id: string;
  email: string;
  email_domain: string;
  email_verified: boolean;
  status: string;
  evidence?: string | null;
  companies?: { name?: string | null; website?: string | null } | { name?: string | null; website?: string | null }[] | null;
};

function companyName(row: AccessRequest) {
  const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
  return company?.name || "Company";
}

export default function AdminCompanyAccess({ accessToken }: { accessToken?: string | null }) {
  const [rows, setRows] = useState<AccessRequest[]>([]);
  const [ready, setReady] = useState(true);
  const [note, setNote] = useState("");

  const load = async () => {
    const res = await authFetch("/api/admin/company-access", {}, accessToken);
    const body = await res.json();
    setReady(body.ready !== false);
    setRows(body.requests || []);
  };

  useEffect(() => {
    void load();
  }, [accessToken]);

  const act = async (requestId: string, action: "approve" | "reject" | "revoke", role?: "admin" | "poster") => {
    await authFetch(
      "/api/admin/company-access",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, action, role, note }) },
      accessToken,
    );
    setNote("");
    await load();
  };

  if (!ready) {
    return <p className="text-sm text-slate-500">Company access requests need the database migration before this desk can store them.</p>;
  }

  return (
    <div className="space-y-3">
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Decision note"
        className="cp-field w-full rounded-lg px-3 py-2 text-sm"
      />
      {rows.length === 0 ? <p className="text-sm text-slate-500">No company access requests.</p> : null}
      {rows.map((row) => (
        <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-900">{companyName(row)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {row.email} · {row.email_domain} · {row.email_verified ? "email confirmed" : "email not confirmed"} · {row.status}
          </p>
          {row.evidence ? <p className="mt-2 text-sm text-slate-600">{row.evidence}</p> : null}
          {row.status === "pending_review" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void act(row.id, "approve", "poster")} className="h-8 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white">Approve poster</button>
              <button type="button" onClick={() => void act(row.id, "approve", "admin")} className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700">Approve admin</button>
              <button type="button" onClick={() => void act(row.id, "reject")} className="h-8 rounded-lg px-3 text-xs font-medium text-rose-700">Reject</button>
            </div>
          ) : null}
          {row.status === "approved" ? (
            <button type="button" onClick={() => void act(row.id, "revoke")} className="mt-3 h-8 rounded-lg px-3 text-xs font-medium text-rose-700">Revoke access</button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
