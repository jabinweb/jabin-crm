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

export function UsersTable({ users, onEdit, onDelete }: UsersTableProps) {
  const rows = Array.isArray(users) ? users : [];
  const getRoleColor = (role: string) => {
    switch (role) {
      case "ADMIN":
      case "admin":
        return "bg-red-100 text-red-700";
      case "user":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

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
          return (
            <div key={user.id} className="flex items-start gap-2 p-3">
              <Link href={`/admin/users/${user.id}`} className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{user.name || "N/A"}</p>
                  {user.isOrphan ? (
                    <Badge variant="outline" className="shrink-0 border-amber-500 text-amber-700">
                      Orphan
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <Badge className={getRoleColor(user.role)}>{user.role}</Badge>
                  {companyLabel ? (
                    <span className="truncate">
                      {companyLabel}
                      {membershipCount > 1 ? ` +${membershipCount - 1}` : ""}
                    </span>
                  ) : null}
                  <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
              <div className="flex shrink-0">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => onEdit(user.id)}
                    aria-label="Edit user"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(user.id)}
                    className="h-10 w-10 text-red-600 hover:text-red-700"
                    aria-label="Delete user"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
    <div className="hidden rounded-none border md:block">
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
                user.primaryCompany?.name ||
                user.companies?.[0]?.name ||
                null;
              const membershipCount = user.companies?.length ?? 0;

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium">{user.name || "N/A"}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      {user.isOrphan ? (
                        <Badge variant="outline" className="border-amber-500 text-amber-700">
                          Orphan
                        </Badge>
                      ) : null}
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
                    <Badge className={getRoleColor(user.role)}>{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/users/${user.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      {onEdit && (
                        <Button variant="ghost" size="sm" onClick={() => onEdit(user.id)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(user.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
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
