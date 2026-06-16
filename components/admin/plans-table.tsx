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
    <div className="rounded-none border">
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
                  <p>Leads: {plan.maxLeads}</p>
                  <p>Emails: {plan.maxEmails}</p>
                  <p>Campaigns: {plan.maxCampaigns}</p>
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
  );
}

