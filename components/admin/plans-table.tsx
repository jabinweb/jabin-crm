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
import { Edit, Trash2 } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  price: number;
  currency: string;
  interval: string;
  maxLeads: number;
  maxEmails: number;
  maxCampaigns: number;
  isActive: boolean;
  _count?: {
    subscriptions: number;
  };
}

interface PlansTableProps {
  plans: Plan[];
  onEdit?: (planId: string) => void;
  onDelete?: (planId: string) => void;
}

export function PlansTable({ plans, onEdit, onDelete }: PlansTableProps) {
  const rows = Array.isArray(plans) ? plans : [];
  return (
    <>
    {/* Phones: one card per plan */}
    <div className="divide-y rounded-md border md:hidden">
      {rows.map((plan) => (
        <div key={plan.id} className="flex items-start gap-2 p-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium">{plan.displayName}</p>
              <Badge
                className={`shrink-0 ${
                  plan.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                }`}
              >
                {plan.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="truncate text-sm text-gray-600">
              {plan.name} · ₹{(plan.price / 100).toLocaleString()} per {plan.interval}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Leads: {plan.maxLeads === -1 ? 'Unlimited' : plan.maxLeads} · Emails:{' '}
              {plan.maxEmails === -1 ? 'Unlimited' : plan.maxEmails} · Campaigns:{' '}
              {plan.maxCampaigns === -1 ? 'Unlimited' : plan.maxCampaigns}
            </p>
            <Badge variant="secondary" className="mt-1.5">
              {plan._count?.subscriptions || 0} users
            </Badge>
          </div>
          <div className="flex shrink-0">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => onEdit(plan.id)}
                aria-label="Edit plan"
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(plan.id)}
                className="h-10 w-10 text-red-600 hover:text-red-700"
                aria-label="Delete plan"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
    <div className="hidden rounded-none border md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plan Name</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Limits</TableHead>
            <TableHead>Subscribers</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((plan) => (
            <TableRow key={plan.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{plan.displayName}</p>
                  <p className="text-sm text-gray-600">{plan.name}</p>
                </div>
              </TableCell>
              <TableCell>
                <p className="font-medium">
                  ₹{(plan.price / 100).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">per {plan.interval}</p>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <p>Leads: {plan.maxLeads === -1 ? 'Unlimited' : plan.maxLeads}</p>
                  <p>Emails: {plan.maxEmails === -1 ? 'Unlimited' : plan.maxEmails}</p>
                  <p>Campaigns: {plan.maxCampaigns === -1 ? 'Unlimited' : plan.maxCampaigns}</p>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {plan._count?.subscriptions || 0} users
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  className={
                    plan.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }
                >
                  {plan.isActive ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(plan.id)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(plan.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </>
  );
}

