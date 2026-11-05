import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";
import { snapshotStartPackLedgerForProfile } from "../../../../lib/startPackLedger";

export async function DELETE(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  await snapshotStartPackLedgerForProfile(supabaseAdmin, auth.profile.id, auth.profile.email);

  await supabaseAdmin.from("profiles").delete().eq("id", auth.profile.id);
  try {
    await supabaseAdmin.auth.admin.deleteUser(auth.profile.id);
  } catch {
    // Login may already be gone; the start-pack ledger stays.
  }

  return NextResponse.json({
    success: true,
    kept: "email_and_company_for_start_pack",
  });
}
