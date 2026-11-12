import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// POST /api/confirmations — "Me too" (complete.pdf §6-C):
// user confirms an existing report once; the DB unique constraint
// (report_id, user_id) makes duplicates impossible, and the status
// engine recomputes quartier state via the reports/confirmations view.
const bodySchema = z.object({
  reportId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Blocked users may not confirm
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_blocked")
    .eq("id", user.id)
    .single();
  if ((profile as { is_blocked: boolean } | null)?.is_blocked) {
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  }

  // The report must exist and be recent (only confirm live reports)
  const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const { data: report } = await supabase
    .from("reports")
    .select("id, created_at")
    .eq("id", parsed.data.reportId)
    .gte("created_at", since)
    .single();
  if (!report) {
    return NextResponse.json({ error: "unknown report" }, { status: 404 });
  }

  const { error } = await supabase
    .from("confirmations")
    .upsert({ report_id: parsed.data.reportId, user_id: user.id } as never, {
      onConflict: "report_id,user_id",
    });

  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }

  // Return the fresh confirmation count for immediate UI feedback
  const { count } = await supabase
    .from("confirmations")
    .select("id", { count: "exact", head: true })
    .eq("report_id", parsed.data.reportId);

  return NextResponse.json({ ok: true, count: count ?? 0 }, { status: 201 });
}
