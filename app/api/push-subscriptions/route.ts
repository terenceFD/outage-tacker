import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// /api/push-subscriptions — web push alert setup per final.pdf §2/§4:
// push_subscriptions(id, user_id, quartier_id, type, endpoint, keys).
// GET    → this device's subscriptions
// POST   → register an alert (endpoint + keys from PushManager.subscribe)
// DELETE → remove an alert (by endpoint, or by quartier/type)
const pushSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  quartierId: z.string().uuid(),
  type: z.enum(["light", "water"]),
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
    .from("push_subscriptions")
    .select("id, quartier_id, type, endpoint")
    .eq("user_id", user.id);

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
  const parsed = pushSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // `never` cast: hand-written Database type limits rpc/insert typing
  const values = {
    user_id: user.id,
    quartier_id: parsed.data.quartierId,
    type: parsed.data.type,
    endpoint: parsed.data.endpoint,
    keys: parsed.data.keys,
  } as never;

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(values, { onConflict: "endpoint,quartier_id,type" });

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
  // Delete either by endpoint (unsubscribe device) or by quartier+type
  const parsed = z
    .object({
      endpoint: z.string().url().optional(),
      quartierId: z.string().uuid().optional(),
      type: z.enum(["light", "water"]).optional(),
    })
    .safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let query = supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id);
  if (parsed.data.endpoint) query = query.eq("endpoint", parsed.data.endpoint);
  if (parsed.data.quartierId)
    query = query.eq("quartier_id", parsed.data.quartierId);
  if (parsed.data.type) query = query.eq("type", parsed.data.type);

  const { error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
