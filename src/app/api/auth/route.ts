import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET ?? "relay-local-dev-secret-change-me";
const COOKIE = "relay_session";

function verify(token: string): string | null {
  const [b64, mac] = token.split(".");
  if (!b64 || !mac) return null;
  const payload = Buffer.from(b64, "base64url").toString("utf8");
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  return payload;
}

/** GET /api/auth — current session user (or null). */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  const userId = token ? verify(token) : null;
  if (!userId) return NextResponse.json({ user: null });
  const user = await db.user.findUnique({ where: { id: userId } }).catch(() => null);
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name ?? undefined, plan: user.plan } });
}
