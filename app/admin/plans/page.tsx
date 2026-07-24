"use client";

import { useEffect, useState } from "react";
import { PlansTable } from "@/components/admin/plans-table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FullTableSkeleton } from "@/components/loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlanModulesEditor } from "@/components/admin/plan-modules-editor";
import {
  ALL_FEATURE_MODULES,
} from "@/lib/feature-module-keys";

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
  modules?: Record<string, boolean> | null;
  _count?: {
    subscriptions: number;
  };
}

function emptyModules(): Record<string, boolean> {
  return Object.fromEntries(ALL_FEATURE_MODULES.map((m) => [m, false]));
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    description: "",
    price: "",
    currency: "INR",
    interval: "month",
    maxLeads: "",
    maxEmails: "",
    maxCampaigns: "",
    isActive: true,
    features: "",
    modules: emptyModules(),
  });

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/plans");
      if (!response.ok) throw new Error("Failed to fetch plans");
      const data = await response.json();
      setPlans(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch plans",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: formData.name,
      displayName: formData.displayName,
      description: formData.description || null,
      price: parseInt(formData.price) * 100, // Convert to paise
      currency: formData.currency,
      interval: formData.interval,
      maxLeads: parseInt(formData.maxLeads),
      maxEmails: parseInt(formData.maxEmails),
      maxCampaigns: parseInt(formData.maxCampaigns),
      isActive: formData.isActive,
      features: formData.features
        ? JSON.parse(formData.features)
        : [],
      modules: formData.modules,
    };

    try {
      const url = editingPlan
        ? `/api/admin/plans/${editingPlan.id}`
        : "/api/admin/plans";
      const method = editingPlan ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to save plan");

      toast({
        title: "Success",
        description: `Plan ${editingPlan ? "updated" : "created"} successfully`,
      });
      fetchPlans();
      setShowDialog(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${editingPlan ? "update" : "create"} plan`,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm("Are you sure you want to delete this plan?")) return;

    try {
      const response = await fetch(`/api/admin/plans/${planId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete plan");

      toast({
        title: "Success",
        description: "Plan deleted successfully",
      });
      fetchPlans();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete plan",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      displayName: "",
      description: "",
      price: "",
      currency: "INR",
      interval: "month",
      maxLeads: "",
      maxEmails: "",
      maxCampaigns: "",
      isActive: true,
      features: "",
      modules: emptyModules(),
    });
    setEditingPlan(null);
  };

  const handleEdit = (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description || "",
        price: (plan.price / 100).toString(),
        currency: plan.currency,
        interval: plan.interval,
        maxLeads: plan.maxLeads.toString(),
        maxEmails: plan.maxEmails.toString(),
        maxCampaigns: plan.maxCampaigns.toString(),
        isActive: plan.isActive,
        features: "",
        modules: plan.modules
          ? { ...emptyModules(), ...(plan.modules as Record<string, boolean>) }
          : emptyModules(),
      });
      setShowDialog(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Subscription plans and module entitlements
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const res = await fetch('/api/admin/plans/sync-modules', { method: 'POST' });
                if (!res.ok) throw new Error('Sync failed');
                const data = await res.json();
                toast({
                  title: 'Modules synced',
                  description: `Updated ${data.updated} plan(s) with default modules`,
                });
                fetchPlans();
              } catch {
                toast({
                  title: 'Error',
                  description: 'Failed to sync default modules',
                  variant: 'destructive',
                });
              }
            }}
          >
            Sync default modules
          </Button>
          <Button onClick={fetchPlans} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setShowDialog(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Plan
          </Button>
        </div>
      </div>

      {loading ? (
        <FullTableSkeleton columnCount={5} rowCount={5} />
      ) : (
        <div className="bg-white rounded-none shadow">
          <div className="p-6">
            <PlansTable
              plans={plans}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </div>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? "Edit Plan" : "Create New Plan"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Plan Name (Slug)</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., pro"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={formData.displayName}
                    onChange={(e) =>
                      setFormData({ ...formData, displayName: e.target.value })
                    }
                    placeholder="e.g., Pro Plan"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Plan description"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="price">Price (₹)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    placeholder="14999"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) =>
                      setFormData({ ...formData, currency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="interval">Interval</Label>
                  <Select
                    value={formData.interval}
                    onValueChange={(value) =>
                      setFormData({ ...formData, interval: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Monthly</SelectItem>
                      <SelectItem value="year">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="maxLeads">Max Leads</Label>
                  <Input
                    id="maxLeads"
                    type="number"
                    value={formData.maxLeads}
                    onChange={(e) =>
                      setFormData({ ...formData, maxLeads: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="maxEmails">Max Emails</Label>
                  <Input
                    id="maxEmails"
                    type="number"
                    value={formData.maxEmails}
                    onChange={(e) =>
                      setFormData({ ...formData, maxEmails: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="maxCampaigns">Max Campaigns</Label>
                  <Input
                    id="maxCampaigns"
                    type="number"
                    value={formData.maxCampaigns}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxCampaigns: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked })
                  }
                />
                <Label htmlFor="isActive">Active</Label>
              </div>

              <PlanModulesEditor
                modules={formData.modules}
                onChange={(modules) => setFormData({ ...formData, modules })}
              />
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingPlan ? "Update Plan" : "Create Plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

