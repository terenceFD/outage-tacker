import { NextResponse } from "next/server";
import { getQuartierList } from "@/lib/data/quartiers";

// GET /api/quartiers — official quartier list for dropdowns (PDF §8).
export async function GET() {
  const { items } = await getQuartierList();
  return NextResponse.json({ quartiers: items });
}
