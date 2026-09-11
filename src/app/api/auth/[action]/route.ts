import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET ?? "relay-local-dev-secret-change-me";
const COOKIE = "relay_session";

export function sign(payload: string): string {
  const mac = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

function publicUser(u: { id: string; email: string; name: string | null; plan: string }) {
  return { id: u.id, email: u.email, name: u.name ?? undefined, plan: u.plan as "free" | "pro" | "business" };
}

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: false,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const body = await req.json().catch(() => ({}));

  try {
    if (action === "signup") {
      const { email, password, name } = body as { email?: string; password?: string; name?: string };
      if (!email || !password || password.length < 8) {
        return NextResponse.json({ error: "Email and a password of at least 8 characters are required." }, { status: 400 });
      }
      const existing = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
      if (existing) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await db.user.create({
        data: { email: email.toLowerCase().trim(), name: name?.trim() || null, passwordHash },
      });
      const res = NextResponse.json({ user: publicUser(user) });
      res.cookies.set(COOKIE, sign(user.id), cookieOpts);
      return res;
    }

    if (action === "signin") {
      const { email, password } = body as { email?: string; password?: string };
      if (!email || !password) {
        return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
      }
      const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
      }
      const res = NextResponse.json({ user: publicUser(user) });
      res.cookies.set(COOKIE, sign(user.id), cookieOpts);
      return res;
    }

    if (action === "signout") {
      const res = NextResponse.json({ ok: true });
      res.cookies.set(COOKIE, "", { ...cookieOpts, maxAge: 0 });
      return res;
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("auth error", err);
    return NextResponse.json({ error: "Authentication service error." }, { status: 500 });
  }
}
