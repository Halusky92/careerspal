import { NextResponse } from "next/server";
import { getSupabaseProfile } from "../../../../../../lib/supabaseServerAuth";
import { getSourcingCronSecret } from "../../../../../../lib/sourcing/config";
import { runPipelineGreenhouse } from "../../../../../../lib/sourcing/runGreenhousePipeline";
import { parseSliceMode, sliceBudgetMs } from "../../../../../../lib/sourcing/pipeline/slice";

export const runtime = "nodejs";
export const maxDuration = 60;

async function requireAdminOrCronSecret(request: Request): Promise<{ ok: true; actorId: string | null } | { ok: false; res: NextResponse }> {
  const secret = new URL(request.url).searchParams.get("secret");
  const expected = getSourcingCronSecret();
  const cron = (process.env.CRON_SECRET || "").trim();
  const alerts = (process.env.ALERTS_CRON_SECRET || "").trim();
  const authHeader = request.headers.get("authorization") || "";
  if (request.headers.get("x-vercel-cron") === "1") {
    return { ok: true, actorId: null };
  }
  if (expected && secret && secret === expected) {
    return { ok: true, actorId: null };
  }
  if (cron && (secret === cron || authHeader === `Bearer ${cron}`)) {
    return { ok: true, actorId: null };
  }
  if (alerts && secret === alerts) {
    return { ok: true, actorId: null };
  }
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, actorId: auth.profile.id };
}

export async function POST(request: Request) {
  const gate = await requireAdminOrCronSecret(request);
  if (!gate.ok) return gate.res;
  const body = (await request.json().catch(() => ({}))) as {
    sourceId?: string;
    limitRaw?: number;
    limitCandidates?: number;
    maxSources?: number;
  };
  try {
    const sourceId = (body.sourceId || "").trim() || null;
    const summary = await runPipelineGreenhouse({
      sourceId,
      limitRaw: body.limitRaw,
      limitCandidates: body.limitCandidates,
      maxSources: sourceId ? undefined : typeof body.maxSources === "number" ? body.maxSources : undefined,
      actorId: gate.actorId,
      trigger: gate.actorId ? "manual" : "github",
      mode: "full",
      timeBudgetMs: 45_000,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Pipeline failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const gate = await requireAdminOrCronSecret(request);
  if (!gate.ok) return gate.res;
  const url = new URL(request.url);
  const sourceId = (url.searchParams.get("sourceId") || "").trim() || null;
  const mode = sourceId ? "full" : parseSliceMode(url.searchParams.get("mode"));
  try {
    const summary = await runPipelineGreenhouse({
      sourceId,
      actorId: gate.actorId,
      trigger: gate.actorId ? "manual" : "github",
      mode,
      maxSources: sourceId ? undefined : 1,
      timeBudgetMs: Math.min(sliceBudgetMs(mode), 45_000),
      includeSalaryEnrichment: mode === "salary",
      includeLogoBackfill: false,
      limitRaw: mode === "full" ? undefined : 25,
      limitCandidates: mode === "full" ? undefined : 40,
    });
    return NextResponse.json({ ok: true, mode, done: summary.done, summary });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Pipeline failed" }, { status: 500 });
  }
}
