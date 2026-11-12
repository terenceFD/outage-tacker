import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// /api/subscriptions — WhatsApp/SMS alert subscriptions per PDF §8:
// id, user_id, quartier_id, type, channel (whatsapp/sms).
// GET    → list my subscriptions
// POST   → upsert one (unique per user/quartier/type/channel)
// DELETE → remove one

const subSchema = z.object({
  quartierId: z.string().uuid(),
  type: z.enum(["light", "water"]),
  channel: z.enum(["whatsapp", "sms"]),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, quartier_id, type, channel, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ subscriptions: data });
}

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
  const parsed = subSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // `never` cast: the hand-written Database type (no codegen) doesn't
  // satisfy the strictest supabase-js v2 generic overloads.
  const values = {
    user_id: user.id,
    quartier_id: parsed.data.quartierId,
    type: parsed.data.type,
    channel: parsed.data.channel,
  } as never;

  const { error } = await supabase
    .from("subscriptions")
    .upsert(values, { onConflict: "user_id,quartier_id,type,channel" });

  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
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
  const parsed = subSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("quartier_id", parsed.data.quartierId)
    .eq("type", parsed.data.type)
    .eq("channel", parsed.data.channel);

  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
