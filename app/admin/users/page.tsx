"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UsersTable } from "@/components/admin/users-table";
import { EditUserDialog } from "@/components/admin/edit-user-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, RefreshCw, Users as UsersIcon, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FullTableSkeleton } from "@/components/loading";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";

interface CompanyRef {
  id: string;
  name: string;
  status?: string;
  slug?: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  status?: string;
  isOrphan?: boolean;
  primaryCompany?: CompanyRef | null;
  companies?: CompanyRef[];
}

interface CompanyOption {
  id: string;
  name: string;
  slug?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const showSkeleton = useDelayedLoading(loading && users.length === 0);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/companies");
      if (!res.ok) return;
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : [];
      setCompanies(
        list.map((c: CompanyOption) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        }))
      );
    } catch {
      /* ignore */
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams();
      if (companyFilter === "orphans") params.set("orphans", "1");
      else if (companyFilter !== "all") params.set("companyId", companyFilter);

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : [];
      setUsers(list);
    } catch {
      setLoadError(true);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [companyFilter, toast]);

  useEffect(() => {
    void fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (user) =>
        user.name?.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.primaryCompany?.name.toLowerCase().includes(q) ||
        user.companies?.some((c) => c.name.toLowerCase().includes(q))
    );
  }, [searchQuery, users]);

  const grouped = useMemo(() => {
    if (companyFilter !== "all") {
      return [{ key: companyFilter, label: null as string | null, users: filteredUsers }];
    }
    const map = new Map<string, { label: string; users: User[] }>();
    for (const user of filteredUsers) {
      const key = user.primaryCompany?.id || user.companies?.[0]?.id || "__orphan__";
      const label =
        user.primaryCompany?.name ||
        user.companies?.[0]?.name ||
        "Users without a company";
      const bucket = map.get(key) ?? { label, users: [] };
      bucket.users.push(user);
      map.set(key, bucket);
    }
    return Array.from(map.entries()).map(([key, v]) => ({
      key,
      label: v.label,
      users: v.users,
    }));
  }, [companyFilter, filteredUsers]);

  const handleDelete = async () => {
    if (!deleteUserId || deleting) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/users/${deleteUserId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        // Surface the API reason (e.g. 409 "created N salary record(s) — suspend instead")
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to delete user");
      }

      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      fetchUsers();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Accounts across the platform, grouped by company.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void fetchUsers()} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Search users or company"
            placeholder="Search users or company…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-full sm:w-[240px]" aria-label="Filter by company">
            <SelectValue placeholder="Filter by company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            <SelectItem value="orphans">Users without a company</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showSkeleton ? (
        <FullTableSkeleton columnCount={5} rowCount={6} />
      ) : loadError && users.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Couldn't load users"
          description="Something went wrong while fetching accounts."
          actionLabel="Try again"
          onAction={() => void fetchUsers()}
          className="rounded-lg border"
        />
      ) : !loading && filteredUsers.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={searchQuery.trim() ? "No users match your search" : "No users here"}
          description={
            searchQuery.trim()
              ? "Try a different name, email, or company."
              : "No accounts match this company filter."
          }
          actionLabel={searchQuery.trim() || companyFilter !== "all" ? "Clear filters" : undefined}
          onAction={
            searchQuery.trim() || companyFilter !== "all"
              ? () => {
                  setSearchQuery("");
                  setCompanyFilter("all");
                }
              : undefined
          }
          className="rounded-lg border"
        />
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.key} className="min-w-0 rounded-lg border bg-card shadow-sm">
              <div className="p-3 sm:p-4 border-b flex items-center justify-between">
                <h2 className="min-w-0 break-words text-sm font-semibold">
                  {group.label ?? "Users"}
                  <span className="text-muted-foreground font-normal ml-2">
                    ({group.users.length})
                  </span>
                </h2>
              </div>
              <div className="p-3 sm:p-4">
                <UsersTable
                  users={group.users}
                  onEdit={(userId) => {
                    const user = users.find((u) => u.id === userId);
                    if (user) setEditUser(user);
                  }}
                  onDelete={(userId) => setDeleteUserId(userId)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <EditUserDialog
        user={editUser}
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
        onSuccess={fetchUsers}
      />

      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => !open && !deleting && setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the account. Prefer removing company membership when they
              still belong to a workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
