import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// POST /api/reports — create a report through the DB rate-limit function.
// Validation per PDF §6 step 4: zod-validate inputs; quartier must exist
// in the official list; rate limit enforced by the DB function itself.
const bodySchema = z.object({
  quartierId: z.string().uuid(),
  type: z.enum(["light", "water"]),
  status: z.enum(["out", "restored"]),
  source: z.enum(["app", "chat"]).default("app"),
  rawText: z.string().max(500).nullable().optional(),
  aiConfidence: z.number().min(0).max(1).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Must be signed in (email + password auth)
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
  const b = parsed.data;

  // Quartier must exist in the official list — never accept invented names
  const { data: quartier } = await supabase
    .from("quartiers")
    .select("id")
    .eq("id", b.quartierId)
    .single();
  if (!quartier) {
    return NextResponse.json({ error: "unknown quartier" }, { status: 400 });
  }

  // Insert via RPC → DB-side rate limit + block check (PDF §5)
  // (cast: generic db type without codegen limits rpc typing)
  const { data, error } = await (supabase as SupabaseClient).rpc(
    "insert_report",
    {
      p_quartier_id: b.quartierId,
      p_type: b.type,
      p_status: b.status,
      p_source: b.source,
      p_raw_text: b.rawText ?? null,
      p_ai_confidence: b.aiConfidence ?? null,
    },
  );

  if (error) {
    const msg = error.message;
    const isRateLimit = msg.includes("rate limit");
    return NextResponse.json(
      { error: isRateLimit ? "rate_limited" : "db_error", message: msg },
      { status: isRateLimit ? 429 : 500 },
    );
  }

  return NextResponse.json({ report: data }, { status: 201 });
}
