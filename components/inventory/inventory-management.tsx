'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { FullTableSkeleton } from "@/components/loading";
import { Loader2 } from "lucide-react";

interface InventoryEntry {
  id: string;
  quantity: number;
  price: number;
  createdAt: string;
  product: {
    name: string;
  };
}

interface InventoryManagementProps {
  productId?: string;
}

export function InventoryManagement({ productId }: InventoryManagementProps) {
  const [open, setOpen] = useState(false);
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    quantity: "",
    price: "",
  });
  
  // Optimization refs
  const hasFetched = useRef(false);
  const abortController = useRef<AbortController | null>(null);
  const retryCount = useRef(0);
  const maxRetries = 3;
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchInventory = useCallback(async (isInitial = false, isPolling = false) => {
    // Prevent multiple simultaneous requests
    if (isLoading && !isInitial && !isPolling) return;
    
    // Cancel any existing request
    if (abortController.current) {
      abortController.current.abort();
    }
    
    abortController.current = new AbortController();
    
    if (isInitial) {
      setIsLoading(true);
      hasFetched.current = true;
    }

    try {
      const queryParams = new URLSearchParams();
      if (productId) queryParams.append("productId", productId);

      const response = await fetch(`/api/inventory?${queryParams}`, {
        signal: abortController.current.signal,
        headers: {
          'Cache-Control': isPolling ? 'no-cache' : 'max-age=60'
        }
      });
      
      if (!response.ok) throw new Error("Failed to fetch inventory");
      
      const data = await response.json();
      setInventory(data);
      retryCount.current = 0; // Reset retry count on success
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Failed to fetch inventory:', error);
        
        // Retry logic for failed requests (but not for polling)
        if (!isPolling && retryCount.current < maxRetries) {
          retryCount.current++;
          setTimeout(() => fetchInventory(false), 1000 * retryCount.current);
        } else if (!isPolling) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to fetch inventory after multiple attempts"
          });
        }
      }
    } finally {
      if (isInitial) {
        setIsLoading(false);
      }
    }
  }, [productId, isLoading]);

  // Setup polling for real-time updates
  const startPolling = useCallback(() => {
    if (pollInterval.current) return;
    
    // Poll every 30 seconds for updates
    pollInterval.current = setInterval(() => {
      fetchInventory(false, true);
    }, 30000);
  }, [fetchInventory]);

  const stopPolling = useCallback(() => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  }, []);

  // Initial fetch and setup polling
  useEffect(() => {
    if (!hasFetched.current) {
      fetchInventory(true);
    }
    
    // Start polling for updates
    startPolling();

    // Cleanup on unmount
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
      stopPolling();
    };
  }, [fetchInventory, startPolling, stopPolling]);

  // Also poll when window gains focus (user returns to tab)
  useEffect(() => {
    const handleFocus = () => {
      fetchInventory(false, true);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchInventory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          quantity: parseInt(formData.quantity),
          price: parseFloat(formData.price),
        }),
      });

      if (!response.ok) throw new Error("Failed to update inventory");

      const newEntry = await response.json();
      
      // Optimistic update - add to local state immediately
      setInventory(prev => [newEntry, ...prev].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));

      toast({
        title: "Success",
        description: "Inventory updated successfully"
      });
      
      setOpen(false);
      setFormData({ quantity: "", price: "" });
      
      // Fetch fresh data after a short delay to ensure consistency
      setTimeout(() => fetchInventory(false, true), 1000);
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update inventory"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Inventory History</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Update Inventory</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Inventory</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && inventory.length === 0 ? (
        <FullTableSkeleton columnCount={4} rowCount={5} />
      ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inventory.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>{formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}</TableCell>
              <TableCell>{entry.quantity}</TableCell>
              <TableCell>${entry.price.toFixed(2)}</TableCell>
              <TableCell>${(entry.quantity * entry.price).toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      )}
    </div>
  );
}
