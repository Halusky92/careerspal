"use client";

import { useState } from "react";

const TOPICS = ["Looking for a role", "Hiring", "Billing", "Something else"] as const;

export default function SupportForm() {
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>("Looking for a role");
  const [message, setMessage] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, topic, message, companyUrl }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setStatus("error");
        setError(data.error || "The message did not send.");
        return;
      }
      setStatus("sent");
      setMessage("");
    } catch {
      setStatus("error");
      setError("The message did not send.");
    }
  };

  if (status === "sent") {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Message sent. Replies go to the email you entered.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm text-slate-700">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900"
          autoComplete="email"
        />
      </label>
      <label className="block text-sm text-slate-700">
        Topic
        <select
          value={topic}
          onChange={(event) => setTopic(event.target.value as (typeof TOPICS)[number])}
          className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
        >
          {TOPICS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-slate-700">
        Message
        <textarea
          required
          minLength={10}
          maxLength={2000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={5}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
        />
      </label>
      <label className="absolute -left-[9999px]" aria-hidden>
        Company URL
        <input value={companyUrl} onChange={(event) => setCompanyUrl(event.target.value)} tabIndex={-1} autoComplete="off" />
      </label>
      {status === "error" ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={status === "sending"}
        className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {status === "sending" ? "Sending" : "Send"}
      </button>
    </form>
  );
}
