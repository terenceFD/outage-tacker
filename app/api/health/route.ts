// Liveness probe for Render's health checks (and any uptime monitor).
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ status: "ok" });
}
