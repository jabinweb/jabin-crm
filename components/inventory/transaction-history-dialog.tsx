'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { useCurrency } from "@/hooks/use-currency"

interface Transaction {
  id: string
  type: 'IN' | 'OUT'
  quantity: number
  price: number
  reason: string
  notes?: string
  createdAt: string
  product: {
    name: string
    sku: string
  }
}

interface TransactionHistoryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactions: Transaction[]
}

export function TransactionHistoryDialog({
  open,
  onOpenChange,
  transactions
}: TransactionHistoryProps) {
  const { formatCurrency } = useCurrency()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Transaction history</DialogTitle>
          <DialogDescription>Recent stock movements in and out of inventory.</DialogDescription>
        </DialogHeader>
        {transactions.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No stock movements recorded yet.
          </p>
        ) : (
          <div className="max-h-[70vh] min-w-0 overflow-auto sm:max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Movement</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {transaction.product?.name ?? '—'}
                      {transaction.product?.sku ? (
                        <span className="block text-sm text-muted-foreground">
                          {transaction.product.sku}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={transaction.type === 'IN' ? 'secondary' : 'destructive'}>
                        {transaction.type === 'IN' ? 'Stock in' : 'Stock out'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{transaction.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(transaction.price) || 0)}
                    </TableCell>
                    <TableCell>{transaction.reason}</TableCell>
                    <TableCell className="text-muted-foreground">{transaction.notes || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
