"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2, Eye } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { humanizeEnum } from "@/lib/format/humanize";

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
  subscription?: {
    status: string;
    plan: {
      name: string;
      displayName: string;
    };
  } | null;
  _count?: {
    leads: number;
    emailCampaigns: number;
  };
  usage?: {
    leadsCreated: number;
    emailsSent: number;
    campaignsCreated: number;
  } | null;
}

interface UsersTableProps {
  users: User[];
  onEdit?: (userId: string) => void;
  onDelete?: (userId: string) => void;
}

function roleTone(role: string) {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300";
    case "SALES":
    case "SUPPORT_MANAGER":
      return "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300";
    default:
      return "bg-muted text-muted-foreground hover:bg-muted";
  }
}

const joined = (value: string) => format(new Date(value), "MMM d, yyyy");

function OrphanBadge({ className = "" }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={`border-amber-500 text-amber-700 dark:text-amber-300 ${className}`}
    >
      No company
    </Badge>
  );
}

export function UsersTable({ users, onEdit, onDelete }: UsersTableProps) {
  const rows = Array.isArray(users) ? users : [];

  return (
    <>
      {/* Phones: one row card per user */}
      <div className="divide-y rounded-md border md:hidden">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No users found</p>
        ) : (
          rows.map((user) => {
            const companyLabel =
              user.primaryCompany?.name || user.companies?.[0]?.name || null;
            const membershipCount = user.companies?.length ?? 0;
            const label = user.name || user.email;
            return (
              <div key={user.id} className="flex items-start gap-2 p-3">
                <Link href={`/admin/users/${user.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{user.name || "Unnamed user"}</p>
                    {user.isOrphan ? <OrphanBadge className="shrink-0" /> : null}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <Badge className={roleTone(user.role)}>{humanizeEnum(user.role)}</Badge>
                    {companyLabel ? (
                      <span className="truncate">
                        {companyLabel}
                        {membershipCount > 1 ? ` +${membershipCount - 1}` : ""}
                      </span>
                    ) : null}
                    <span>Joined {joined(user.createdAt)}</span>
                  </div>
                </Link>
                <div className="flex shrink-0">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => onEdit(user.id)}
                      aria-label={`Edit ${label}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(user.id)}
                      className="h-10 w-10 text-destructive hover:text-destructive"
                      aria-label={`Delete ${label}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              rows.map((user) => {
                const companyLabel =
                  user.primaryCompany?.name || user.companies?.[0]?.name || null;
                const membershipCount = user.companies?.length ?? 0;
                const label = user.name || user.email;

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="font-medium hover:underline"
                          >
                            {user.name || "Unnamed user"}
                          </Link>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        {user.isOrphan ? <OrphanBadge /> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {companyLabel ? (
                        <div className="text-sm">
                          <p className="font-medium">{companyLabel}</p>
                          {membershipCount > 1 ? (
                            <p className="text-xs text-muted-foreground">
                              +{membershipCount - 1} more
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={roleTone(user.role)}>{humanizeEnum(user.role)}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="whitespace-nowrap text-sm text-muted-foreground">
                        {joined(user.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/admin/users/${user.id}`} aria-label={`View ${label}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(user.id)}
                            aria-label={`Edit ${label}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(user.id)}
                            className="text-destructive hover:text-destructive"
                            aria-label={`Delete ${label}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
