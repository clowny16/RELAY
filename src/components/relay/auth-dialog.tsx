"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUiStore } from "@/lib/store/ui-store";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "sonner";

export function AuthDialog() {
  const { authOpen, setAuthOpen } = useUiStore();
  const { signIn, signUp } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setAuthOpen(false);
    setError(null);
  };

  const submit = async (mode: "signin" | "signup") => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") await signIn(email, password);
      else await signUp(email, password, name);
      toast.success(mode === "signin" ? "Signed in" : "Account created", { description: "Files still never leave your device." });
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={authOpen} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Account</DialogTitle>
          <DialogDescription>Optional — conversions work fully without an account. Accounts only save plan preferences.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="signin">
          <TabsList className="w-full">
            <TabsTrigger value="signin" className="flex-1">
              Sign In
            </TabsTrigger>
            <TabsTrigger value="signup" className="flex-1">
              Create Account
            </TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="flex flex-col gap-3 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth-email">Email</Label>
              <Input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth-password">Password</Label>
              <Input id="auth-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button disabled={busy || !email || !password} onClick={() => void submit("signin")}>
              {busy ? "Signing in…" : "Sign In"}
            </Button>
          </TabsContent>
          <TabsContent value="signup" className="flex flex-col gap-3 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth-name">Name (optional)</Label>
              <Input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada" autoComplete="name" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth-email2">Email</Label>
              <Input id="auth-email2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth-password2">Password (min 8 chars)</Label>
              <Input id="auth-password2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button disabled={busy || !email || password.length < 8} onClick={() => void submit("signup")}>
              {busy ? "Creating…" : "Create Account"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
