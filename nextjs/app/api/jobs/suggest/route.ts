import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const STATIC_ROLES = [
  "Operations",
  "Systems",
  "Automation",
  "RevOps",
  "Product Ops",
  "Chief of Staff",
  "Remote",
];

function sanitize(raw: string) {
  return raw.replace(/[%_,()"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 64);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = sanitize(searchParams.get("q") || "");
  const kind = searchParams.get("kind") === "location" ? "location" : "query";
  if (q.length < 1) {
    return NextResponse.json({ items: [] });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ items: [] });
  }

  const needle = q.toLowerCase();
  const staticHits = STATIC_ROLES.filter((label) => label.toLowerCase().includes(needle)).map((label) => ({
    id: `static-${label}`,
    label,
    hint: "Category",
  }));

  let queryBuilder = supabaseAdmin
    .from("jobs")
    .select("title,location,keywords,companies(name)")
    .eq("status", "published")
    .order("timestamp", { ascending: false })
    .limit(40);

  if (kind === "location") {
    queryBuilder = queryBuilder.ilike("location", `%${q}%`);
  } else {
    queryBuilder = queryBuilder.or(`title.ilike.%${q}%,keywords.ilike.%${q}%`);
  }

  const [{ data }, companiesRes] = await Promise.all([
    queryBuilder,
    kind === "query"
      ? supabaseAdmin.from("companies").select("name").ilike("name", `%${q}%`).limit(6)
      : Promise.resolve({ data: [] as Array<{ name?: string }> }),
  ]);
  const seen = new Set<string>();
  const items: Array<{ id: string; label: string; hint: string }> = [];

  const push = (label: string, hint: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const key = `${hint}:${trimmed.toLowerCase()}`;
    if (seen.has(key)) return;
    if (!trimmed.toLowerCase().includes(needle)) return;
    seen.add(key);
    items.push({ id: key, label: trimmed, hint });
  };

  if (kind !== "location") {
    staticHits.forEach((hit) => push(hit.label, hit.hint));
    for (const company of companiesRes.data || []) {
      push(String(company.name || ""), "Company");
    }
  }

  for (const row of data || []) {
    const company = Array.isArray(row.companies) ? row.companies[0]?.name : (row.companies as { name?: string } | null)?.name;
    if (kind === "location") {
      push(String(row.location || ""), "Location");
    } else {
      push(String(row.title || ""), "Role");
      if (company) push(company, "Company");
    }
    if (items.length >= 8) break;
  }

  return NextResponse.json(
    { items: items.slice(0, 8) },
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=120" } },
  );
}
