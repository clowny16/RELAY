import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET ?? "relay-local-dev-secret-change-me";
const COOKIE = "relay_session";

const PLANS = new Set(["free", "pro", "business"]);

function verify(token: string): string | null {
  const [b64, mac] = token.split(".");
  if (!b64 || !mac) return null;
  const payload = Buffer.from(b64, "base64url").toString("utf8");
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  return payload;
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  const userId = token ? verify(token) : null;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required to manage your plan." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const plan = body.plan as string;
  if (!PLANS.has(plan)) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }
  const user = await db.user.update({ where: { id: userId }, data: { plan } });
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name ?? undefined, plan: user.plan },
    note: "Demo billing — no payment was processed.",
  });
}
