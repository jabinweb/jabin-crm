"use client";

import { useEffect, useState } from "react";
import { PlansTable } from "@/components/admin/plans-table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, RefreshCw, CreditCard } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
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
import { confirmAction } from "@/lib/confirm-action";

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
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
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
    setLoadError(false);
    try {
      const response = await fetch("/api/admin/plans");
      if (!response.ok) throw new Error("Failed to fetch plans");
      const data = await response.json();
      setPlans(data);
    } catch (error) {
      setLoadError(true);
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
    if (saving) return;

    const data = {
      name: formData.name,
      displayName: formData.displayName,
      description: formData.description || null,
      // Convert to paise — parseInt dropped the decimal part (₹499.50 → 49900)
      price: Math.round(parseFloat(formData.price) * 100),
      currency: formData.currency,
      interval: formData.interval,
      maxLeads: parseInt(formData.maxLeads),
      maxEmails: parseInt(formData.maxEmails),
      maxCampaigns: parseInt(formData.maxCampaigns),
      isActive: formData.isActive,
      modules: formData.modules,
    } as Record<string, unknown>;

    // The form has no features editor: send [] on create, but leave an edited plan's
    // existing features alone instead of wiping them on every save.
    if (formData.features) {
      try {
        data.features = JSON.parse(formData.features);
      } catch {
        toast({ title: "Error", description: "Features must be valid JSON", variant: "destructive" });
        return;
      }
    } else if (!editingPlan) {
      data.features = [];
    }

    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    const subscribers = plan?._count?.subscriptions ?? 0;
    const ok = await confirmAction({
      title: `Delete ${plan?.displayName ?? "this plan"}?`,
      description:
        subscribers > 0
          ? `${subscribers} subscription${subscribers === 1 ? " is" : "s are"} on this plan. Consider marking it inactive instead.`
          : "This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Subscription plans and module entitlements
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={syncing}
            onClick={async () => {
              const ok = await confirmAction({
                title: "Sync catalog defaults?",
                description:
                  "Overwrites each plan's module entitlements with the catalog defaults. Custom module changes on plans will be replaced.",
                confirmLabel: "Sync",
              });
              if (!ok) return;
              setSyncing(true);
              try {
                const res = await fetch(
                  '/api/admin/plans/sync-modules?force=1&catalog=1',
                  { method: 'POST' }
                );
                if (!res.ok) throw new Error('Sync failed');
                const data = await res.json();
                toast({
                  title: 'Plans synced',
                  description: `Updated ${data.updated} plan(s) from catalog defaults (incl. WhatsApp on Starter)`,
                });
                fetchPlans();
              } catch {
                toast({
                  title: 'Error',
                  description: 'Failed to sync plan defaults',
                  variant: 'destructive',
                });
              } finally {
                setSyncing(false);
              }
            }}
          >
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Sync catalog defaults
          </Button>
          <Button onClick={fetchPlans} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setShowDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create plan
          </Button>
        </div>
      </div>

      {loading ? (
        <FullTableSkeleton columnCount={5} rowCount={5} />
      ) : loadError ? (
        <EmptyState
          icon={CreditCard}
          title="Couldn't load plans"
          description="Something went wrong while fetching subscription plans."
          actionLabel="Try again"
          onAction={fetchPlans}
          className="rounded-lg border"
        />
      ) : plans.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No plans yet"
          description="Create a plan to set prices, usage limits, and which modules workspaces get."
          actionLabel="Create plan"
          onAction={() => {
            resetForm();
            setShowDialog(true);
          }}
          className="rounded-lg border"
        />
      ) : (
        <PlansTable plans={plans} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? "Edit plan" : "Create plan"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name">Plan key (slug)</Label>
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
                  <Label htmlFor="displayName">Display name</Label>
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="price">Price ({formData.currency})</Label>
                  <Input
                    id="price"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
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
                    <SelectTrigger id="currency">
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
                    <SelectTrigger id="interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Monthly</SelectItem>
                      <SelectItem value="year">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="maxLeads">Max leads</Label>
                  <Input
                    id="maxLeads"
                    type="number"
                    min={-1}
                    step={1}
                    value={formData.maxLeads}
                    onChange={(e) =>
                      setFormData({ ...formData, maxLeads: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="maxEmails">Max emails</Label>
                  <Input
                    id="maxEmails"
                    type="number"
                    min={-1}
                    step={1}
                    value={formData.maxEmails}
                    onChange={(e) =>
                      setFormData({ ...formData, maxEmails: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="maxCampaigns">Max campaigns</Label>
                  <Input
                    id="maxCampaigns"
                    type="number"
                    min={-1}
                    step={1}
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

              <p className="-mt-2 text-xs text-muted-foreground">Use -1 for unlimited.</p>

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
                disabled={saving}
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {editingPlan ? "Save changes" : "Create plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

