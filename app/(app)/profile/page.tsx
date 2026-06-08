"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Camera, LogOut, Baby } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  isApproved: boolean;
  avatarUrl?: string | null;
  hasBabyPlanner?: boolean;
};

type MessageKind = "success" | "error" | null;

function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export default function ProfilePage() {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ kind: MessageKind; text: string }>({
    kind: null,
    text: "",
  });

  const [uploading, setUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ kind: MessageKind; text: string }>({
    kind: null,
    text: "",
  });

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ kind: MessageKind; text: string }>({
    kind: null,
    text: "",
  });

  const [hasBabyPlanner, setHasBabyPlanner] = useState(false);
  const [savingBaby, setSavingBaby] = useState(false);
  const [babyMsg, setBabyMsg] = useState<{ kind: MessageKind; text: string }>({
    kind: null,
    text: "",
  });

  // Load session on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session");
        const json = await res.json();
        // NextAuth returns { user, expires } — NOT { data: { user } }
        const u: SessionUser | null = json?.user ?? null;
        if (cancelled) return;
        if (!u) {
          router.replace("/login");
          return;
        }
        setUser(u);
        setName(u.name ?? "");
        setHasBabyPlanner(!!u.hasBabyPlanner);
        setAuthChecked(true);
      } catch {
        if (!cancelled) router.replace("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleToggleBabyPlanner(next: boolean) {
    if (!user) return;
    const previous = hasBabyPlanner;
    // Optimistic update — flip the UI immediately, roll back on error
    setHasBabyPlanner(next);
    setSavingBaby(true);
    setBabyMsg({ kind: null, text: "" });
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasBabyPlanner: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        setHasBabyPlanner(previous);
        setBabyMsg({
          kind: "error",
          text: json?.error ?? "Failed to update setting.",
        });
        return;
      }
      setBabyMsg({
        kind: "success",
        text: next
          ? "Baby planner enabled. A Baby column will appear in your weekly planner."
          : "Baby planner disabled. The Baby column has been hidden.",
      });
      // Refresh the session JWT so server-side code (planner, API routes) sees the new value.
      // IMPORTANT: must pass a non-empty `data` object — Auth.js v5's update() turns into a
      // GET (no body) when called with no arg, and the server's GET /api/auth/session handler
      // does NOT fire the jwt callback with trigger="update". Only POST (body present) does.
      // See @auth/core/lib/index.js: GET→actions.session(...), POST→actions.session(..., true, body.data).
      await updateSession({ hasBabyPlanner: next });
      router.refresh();
    } catch {
      setHasBabyPlanner(previous);
      setBabyMsg({ kind: "error", text: "Network error. Try again." });
    } finally {
      setSavingBaby(false);
    }
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNameMsg({ kind: "error", text: "Name cannot be empty." });
      return;
    }
    if (trimmed === user.name) {
      setNameMsg({ kind: "error", text: "No changes to save." });
      return;
    }

    setSavingName(true);
    setNameMsg({ kind: null, text: "" });
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNameMsg({
          kind: "error",
          text: json?.error ?? "Failed to update name.",
        });
        return;
      }
      setNameMsg({ kind: "success", text: "Name updated." });
      // Refresh JWT so the new name flows through to the UserMenu and any
      // other component that reads the session. Pass a data arg so the
      // client sends a POST — see handleToggleBabyPlanner for the Auth.js
      // v5 GET-vs-POST trigger="update" gotcha.
      await updateSession({ name: trimmed });
      router.refresh();
    } catch {
      setNameMsg({ kind: "error", text: "Network error. Try again." });
    } finally {
      setSavingName(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so selecting the same file twice still fires
    if (e.target) e.target.value = "";
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setAvatarMsg({ kind: "error", text: "Image must be under 5MB." });
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setAvatarMsg({ kind: "error", text: "Only JPEG, PNG, or WebP allowed." });
      return;
    }

    setUploading(true);
    setAvatarMsg({ kind: null, text: "" });

    try {
      // Step 1: upload file → get URL
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/profile/avatar", {
        method: "POST",
        body: fd,
      });
      const upJson = await upRes.json();
      if (!upRes.ok) {
        setAvatarMsg({
          kind: "error",
          text: upJson?.error ?? "Upload failed.",
        });
        return;
      }
      const avatarUrl: string | undefined = upJson?.data?.avatarUrl;
      if (!avatarUrl) {
        setAvatarMsg({ kind: "error", text: "Upload response missing URL." });
        return;
      }

      // Step 2: persist URL on the user record
      const patchRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl }),
      });
      const patchJson = await patchRes.json();
      if (!patchRes.ok) {
        setAvatarMsg({
          kind: "error",
          text: patchJson?.error ?? "Failed to save avatar.",
        });
        return;
      }

      setAvatarMsg({ kind: "success", text: "Photo updated." });
      // Refresh JWT so the new avatarUrl flows through to the UserMenu.
      // Pass a data arg so the client sends POST (see handleToggleBabyPlanner
      // for the Auth.js v5 GET-vs-POST trigger="update" gotcha).
      await updateSession({ avatarUrl });
      router.refresh();
    } catch {
      setAvatarMsg({ kind: "error", text: "Network error. Try again." });
    } finally {
      setUploading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg({ kind: null, text: "" });

    if (!currentPwd || !newPwd || !confirmPwd) {
      setPwdMsg({ kind: "error", text: "All password fields are required." });
      return;
    }
    if (newPwd.length < 8) {
      setPwdMsg({
        kind: "error",
        text: "New password must be at least 8 characters.",
      });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ kind: "error", text: "New passwords do not match." });
      return;
    }
    if (newPwd === currentPwd) {
      setPwdMsg({
        kind: "error",
        text: "New password must differ from current password.",
      });
      return;
    }

    setSavingPwd(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPwd,
          newPassword: newPwd,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPwdMsg({
          kind: "error",
          text: json?.error ?? "Failed to change password.",
        });
        return;
      }
      setPwdMsg({ kind: "success", text: "Password changed." });
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch {
      setPwdMsg({ kind: "error", text: "Network error. Try again." });
    } finally {
      setSavingPwd(false);
    }
  }

  if (!authChecked || !user) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your account settings
        </p>
      </div>

      {/* Avatar */}
      <Card>
        <CardHeader>
          <CardTitle>Photo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar size="lg" className="size-20">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.name} />
              ) : null}
              <AvatarFallback className="text-lg">
                {initialsOf(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-1.5"
              >
                <Camera size={16} />
                {uploading ? "Uploading…" : "Upload photo"}
              </Button>
              <p className="text-xs text-muted-foreground">
                JPEG, PNG, or WebP. Max 5MB.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </div>
          {avatarMsg.kind && (
            <p
              className={cn(
                "text-sm",
                avatarMsg.kind === "error"
                  ? "text-destructive"
                  : "text-emerald-600"
              )}
            >
              {avatarMsg.text}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Name */}
      <Card>
        <CardHeader>
          <CardTitle>Name</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveName} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Display name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                disabled={savingName}
              />
              <p className="text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={savingName}>
                {savingName ? "Saving…" : "Save"}
              </Button>
              {nameMsg.kind && (
                <p
                  className={cn(
                    "text-sm",
                    nameMsg.kind === "error"
                      ? "text-destructive"
                      : "text-emerald-600"
                  )}
                >
                  {nameMsg.text}
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Planner settings — Baby meal slot toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Baby size={18} />
            Planner settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 flex-1">
              <Label htmlFor="baby-planner-toggle" className="text-sm font-medium">
                Show Baby meal slot in weekly planner
              </Label>
              <p className="text-xs text-muted-foreground">
                Add a fourth &quot;Baby&quot; column to your weekly planner so you can plan baby meals alongside breakfast, lunch, and dinner. Recipes tagged with the Baby category will be available for that slot.
              </p>
            </div>
            <button
              id="baby-planner-toggle"
              type="button"
              role="switch"
              aria-checked={hasBabyPlanner}
              disabled={savingBaby}
              onClick={() => handleToggleBabyPlanner(!hasBabyPlanner)}
              className={cn(
                "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                hasBabyPlanner ? "bg-primary" : "bg-muted",
                savingBaby && "opacity-50 cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out",
                  hasBabyPlanner ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
          {babyMsg.kind && (
            <p
              className={cn(
                "text-sm",
                babyMsg.kind === "error" ? "text-destructive" : "text-emerald-600"
              )}
            >
              {babyMsg.text}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="profile-current-pwd">Current password</Label>
              <Input
                id="profile-current-pwd"
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                autoComplete="current-password"
                disabled={savingPwd}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-new-pwd">New password</Label>
              <Input
                id="profile-new-pwd"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                autoComplete="new-password"
                disabled={savingPwd}
                minLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-confirm-pwd">Confirm new password</Label>
              <Input
                id="profile-confirm-pwd"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                autoComplete="new-password"
                disabled={savingPwd}
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                At least 8 characters.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={savingPwd}>
                {savingPwd ? "Changing…" : "Change password"}
              </Button>
              {pwdMsg.kind && (
                <p
                  className={cn(
                    "text-sm",
                    pwdMsg.kind === "error"
                      ? "text-destructive"
                      : "text-emerald-600"
                  )}
                >
                  {pwdMsg.text}
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Sign out */}
      <Card>
        <CardHeader>
          <CardTitle>Sign out</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Sign out of this device. You can sign back in any time.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="gap-2"
          >
            <LogOut size={16} />
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
