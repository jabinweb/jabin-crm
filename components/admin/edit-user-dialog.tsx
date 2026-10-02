"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface EditUserDialogProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: EditUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "SALES",
  });
  const { toast } = useToast();

  // The dialog stays mounted while the page switches users — reload the form each time
  useEffect(() => {
    setFormData({
      name: user?.name || "",
      email: user?.email || "",
      role: user?.role || "SALES",
    });
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to update user");
      }

      toast({
        title: "Success",
        description: "User updated successfully",
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-user-name">Name</Label>
              <Input
                id="edit-user-name"
                autoComplete="off"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="edit-user-email">Email</Label>
              <Input
                id="edit-user-email"
                type="email"
                autoComplete="off"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="edit-user-role">Role</Label>
              <Select
                value={formData.role}
                disabled={formData.role === "SUPER_ADMIN"}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger id="edit-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formData.role === "SUPER_ADMIN" ? (
                    <SelectItem value="SUPER_ADMIN">Super admin</SelectItem>
                  ) : null}
                  {/* Must match the UserRole enum — the API ignores anything else */}
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="SALES">Sales</SelectItem>
                  <SelectItem value="SUPPORT_MANAGER">Support manager</SelectItem>
                  <SelectItem value="TECHNICIAN">Technician</SelectItem>
                  <SelectItem value="CUSTOMER">Customer</SelectItem>
                </SelectContent>
              </Select>
              {formData.role === "SUPER_ADMIN" ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Platform super admins can't be changed from here.
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
