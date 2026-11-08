"use client";

import { useEffect, useMemo, useState } from "react";
import { useSupabaseAuth } from "./Providers";
import { authFetch } from "../lib/authFetch";

type AccountRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  createdAt?: string | null;
};

type AlertRow = {
  email: string;
  preference?: string;
  joinedAt?: string | null;
  source?: "guest" | "account";
  confirmed?: boolean;
};

const day = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
};

const copyText = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};

export default function AdminInbox({ compact }: { compact?: boolean }) {
  const { accessToken } = useSupabaseAuth();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    Promise.all([
      authFetch("/api/admin/users", {}, accessToken),
      authFetch("/api/admin/subscribers", {}, accessToken),
    ]).then(async ([usersRes, alertsRes]) => {
      const usersData = usersRes.ok ? ((await usersRes.json()) as { users?: AccountRow[] }) : { users: [] };
      const alertsData = alertsRes.ok ? ((await alertsRes.json()) as { subscribers?: AlertRow[] }) : { subscribers: [] };
      if (cancelled) return;
      setAccounts(usersData.users || []);
      setAlerts(alertsData.subscribers || []);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const accountEmails = useMemo(
    () => accounts.map((row) => (row.email || "").trim()).filter(Boolean),
    [accounts],
  );
  const alertEmails = useMemo(
    () => [...new Set(alerts.map((row) => row.email).filter(Boolean))],
    [alerts],
  );

  const markCopied = (label: string) => {
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const wrap = compact
    ? "rounded-lg border border-emerald-900/40 bg-zinc-950/80 p-4 text-zinc-200"
    : "rounded-xl border border-slate-200 bg-white overflow-hidden";
  const head = compact ? "text-[10px] uppercase tracking-widest text-zinc-500" : "text-sm font-medium text-slate-900";
  const sub = compact ? "text-[11px] text-zinc-500" : "text-xs text-slate-500";
  const rowText = compact ? "text-xs text-zinc-300" : "text-sm text-slate-800";
  const muted = compact ? "text-zinc-500" : "text-slate-500";
  const btn = compact
    ? "h-7 px-2 rounded border border-emerald-800/70 text-[11px] uppercase tracking-wide text-emerald-300"
    : "h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600";

  return (
    <div className="space-y-4">
      <section className={wrap}>
        <div className={`flex items-start justify-between gap-3 ${compact ? "" : "px-4 py-3 border-b border-slate-100"}`}>
          <div>
            <p className={head}>Registered accounts</p>
            <p className={`${sub} mt-1`}>
              {accounts.length} sign-ins. Emails stay on this admin view only.
            </p>
          </div>
          <button
            type="button"
            className={btn}
            onClick={async () => {
              if (await copyText(accountEmails.join("\n"))) markCopied("accounts");
            }}
            disabled={accountEmails.length === 0}
          >
            {copied === "accounts" ? "Copied" : "Copy emails"}
          </button>
        </div>
        {accounts.length === 0 ? (
          <p className={`${sub} ${compact ? "mt-3" : "px-4 py-8"}`}>No accounts yet.</p>
        ) : (
          <ul className={compact ? "mt-3 space-y-2" : "divide-y divide-slate-100"}>
            {accounts.map((row) => (
              <li key={row.id} className={compact ? "flex justify-between gap-3" : "flex items-center gap-3 px-4 py-2.5"}>
                <div className="min-w-0">
                  <div className={`${rowText} truncate`}>{row.email || "—"}</div>
                  <div className={`text-[11px] ${muted}`}>
                    {row.name || "No name"} · {row.role || "—"} · {day(row.createdAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={wrap}>
        <div className={`flex items-start justify-between gap-3 ${compact ? "" : "px-4 py-3 border-b border-slate-100"}`}>
          <div>
            <p className={head}>Alert emails</p>
            <p className={`${sub} mt-1`}>
              Guest opt-ins and logged-in saved alerts. Pending means they have not confirmed yet.
            </p>
          </div>
          <button
            type="button"
            className={btn}
            onClick={async () => {
              if (await copyText(alertEmails.join("\n"))) markCopied("alerts");
            }}
            disabled={alertEmails.length === 0}
          >
            {copied === "alerts" ? "Copied" : "Copy emails"}
          </button>
        </div>
        {alerts.length === 0 ? (
          <p className={`${sub} ${compact ? "mt-3" : "px-4 py-8"}`}>No alert emails yet.</p>
        ) : (
          <ul className={compact ? "mt-3 space-y-2" : "divide-y divide-slate-100"}>
            {alerts.map((row) => (
              <li
                key={`${row.source}-${row.email}-${row.joinedAt || ""}`}
                className={compact ? "flex justify-between gap-3" : "flex items-start gap-3 px-4 py-2.5"}
              >
                <div className="min-w-0">
                  <div className={`${rowText} truncate`}>{row.email}</div>
                  <div className={`text-[11px] ${muted}`}>
                    {row.source === "account" ? "Account alert" : "Guest alert"}
                    {row.confirmed === false ? " · pending confirm" : " · confirmed"}
                    {row.preference ? ` · ${row.preference}` : ""}
                    {` · ${day(row.joinedAt)}`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
