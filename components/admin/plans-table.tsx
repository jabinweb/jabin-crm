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
import { formatCurrency } from "@/lib/currency";

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

const limit = (value: number) => (value === -1 ? "Unlimited" : value.toLocaleString());

/** Plan prices are stored in minor units (paise / cents). */
const planPrice = (plan: Plan) =>
  plan.price === 0 ? "Free" : formatCurrency(plan.price / 100, plan.currency);

const subscriberLabel = (plan: Plan) => {
  const n = plan._count?.subscriptions || 0;
  return `${n} subscriber${n === 1 ? "" : "s"}`;
};

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      className={
        active
          ? "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300"
          : "bg-muted text-muted-foreground hover:bg-muted"
      }
    >
      {active ? "Active" : "Inactive"}
    </Badge>
  );
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
                <StatusBadge active={plan.isActive} />
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {plan.name} · {planPrice(plan)}
                {plan.price > 0 ? ` per ${plan.interval}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Leads: {limit(plan.maxLeads)} · Emails: {limit(plan.maxEmails)} · Campaigns:{" "}
                {limit(plan.maxCampaigns)}
              </p>
              <Badge variant="secondary" className="mt-1.5">
                {subscriberLabel(plan)}
              </Badge>
            </div>
            <div className="flex shrink-0">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => onEdit(plan.id)}
                  aria-label={`Edit ${plan.displayName}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(plan.id)}
                  className="h-10 w-10 text-destructive hover:text-destructive"
                  aria-label={`Delete ${plan.displayName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
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
                    <p className="text-sm text-muted-foreground">{plan.name}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="font-medium tabular-nums">{planPrice(plan)}</p>
                  {plan.price > 0 && (
                    <p className="text-sm text-muted-foreground">per {plan.interval}</p>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <p>Leads: {limit(plan.maxLeads)}</p>
                    <p>Emails: {limit(plan.maxEmails)}</p>
                    <p>Campaigns: {limit(plan.maxCampaigns)}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{subscriberLabel(plan)}</Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge active={plan.isActive} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(plan.id)}
                        aria-label={`Edit ${plan.displayName}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(plan.id)}
                        className="text-destructive hover:text-destructive"
                        aria-label={`Delete ${plan.displayName}`}
                      >
                        <Trash2 className="h-4 w-4" />
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
