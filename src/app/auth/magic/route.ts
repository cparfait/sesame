import { NextResponse, type NextRequest } from "next/server";
import { consumeMagicToken } from "@/lib/magic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const next = token ? await consumeMagicToken(token) : null;
  const target = next ?? "/login?error=magic";
  return NextResponse.redirect(new URL(target, req.nextUrl.origin));
}
