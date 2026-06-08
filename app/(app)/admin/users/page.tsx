"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  isApproved: boolean;
  createdAt: string;
};

type ResetResult = {
  open: boolean;
  tempPassword: string;
  userName: string;
  userEmail: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resetDialog, setResetDialog] = useState<ResetResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    const res = await fetch(`/api/admin/users?status=${filter}`);
    const json = await res.json();
    setUsers(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, [filter]);

  async function handleAction(userId: string, action: "approve" | "reject") {
    setActionLoading(userId + action);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    setActionLoading(null);
    fetchUsers();
  }

  async function handleResetPassword(userId: string) {
    if (!confirm("Generate a new temporary password for this user? Their current password will stop working.")) return;
    setActionLoading(userId + "reset");
    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    setActionLoading(null);
    if (!res.ok) {
      alert(json.error ?? "Failed to reset password");
      return;
    }
    setCopied(false);
    setResetDialog({
      open: true,
      tempPassword: json.data.tempPassword,
      userName: json.data.name,
      userEmail: json.data.email,
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(resetDialog?.tempPassword ?? "");
    setCopied(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">User Management</h1>
        <p className="text-muted-foreground mt-1">Approve or reject pending registrations</p>
      </div>

      <div className="flex gap-2">
        {(["pending", "approved", "all"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground text-sm">No users found.</p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border"
                >
                  <div>
                    <p className="font-medium text-sm">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Badge variant={user.isApproved ? "default" : "secondary"}>
                      {user.isApproved ? "Approved" : "Pending"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResetPassword(user.id)}
                      disabled={actionLoading === user.id + "reset"}
                    >
                      {actionLoading === user.id + "reset" ? "Resetting…" : "Reset Password"}
                    </Button>
                    {!user.isApproved && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleAction(user.id, "approve")}
                          disabled={actionLoading === user.id + "approve"}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(user.id, "reject")}
                          disabled={actionLoading === user.id + "reject"}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={resetDialog?.open ?? false}
        onOpenChange={(open) => {
          if (!open) setResetDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Reset</DialogTitle>
            <DialogDescription>
              New temporary password for <strong>{resetDialog?.userName}</strong> (
              {resetDialog?.userEmail}). Share this once — it won&apos;t be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={resetDialog?.tempPassword ?? ""}
              readOnly
              className="font-mono"
            />
            <Button onClick={handleCopy} className="w-full" variant={copied ? "outline" : "default"}>
              {copied ? "✓ Copied" : "Copy to Clipboard"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
