"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  isApproved: boolean;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
                  <div className="flex items-center gap-2">
                    <Badge variant={user.isApproved ? "default" : "secondary"}>
                      {user.isApproved ? "Approved" : "Pending"}
                    </Badge>
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
    </div>
  );
}
