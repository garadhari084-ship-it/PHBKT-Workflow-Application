'use client';

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import type { WorkItem, Transaction, User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, FilePenLine, Trash2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from 'react-router-dom';
import ClientFormattedDate from '@/components/app/client-formatted-date';
import WorkItemTable from '@/components/app/work-item-table';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';

const transactionSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  type: z.enum(['Debit Invoice', 'Credit Invoice', 'Credit Advance']),
  amount: z.preprocess(
    (a) => parseFloat(z.string().parse(a)),
    z.number().positive('Amount must be a positive number.')
  ),
});

export default function PaymentTransactionsPage() {
  const firestore = useFirestore();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'transactions'));
  }, [firestore]);

  const workItemsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'work_items'));
  }, [firestore]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);

  const { data: transactionsData, isLoading: isLoadingTransactions, error: transactionsError } = useCollection<Transaction>(transactionsQuery);
  const { data: workItemsData, isLoading: isLoadingWorkItems, error: workItemsError } = useCollection<WorkItem>(workItemsQuery);
  const { data: usersData, isLoading: isLoadingUsers, error: usersError } = useCollection<User>(usersQuery);

  const transactions = transactionsData || [];
  const workItems = workItemsData || [];
  const users = usersData || [];

  const isLoading = isLoadingTransactions || isLoadingWorkItems || isLoadingUsers;
  const error = transactionsError || workItemsError || usersError;

  const editForm = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: '',
      type: 'Debit Invoice',
      amount: 0,
    },
  });

  const handleEditClick = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    editForm.reset({
      description: transaction.description,
      type: transaction.type,
      amount: transaction.amount,
    });
  };

  const handleUpdateTransaction = async (values: z.infer<typeof transactionSchema>) => {
    if (!firestore || !editingTransaction) return;
    setIsSubmitting(true);

    const transRef = doc(firestore, `transactions/${editingTransaction.id}`);
    try {
      await updateDoc(transRef, values);
      toast({ title: 'Transaction Updated' });
      setEditingTransaction(null);
    } catch (error) {
      console.error("Error updating transaction:", error);
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: transRef.path, operation: 'update', requestResourceData: values }));
      toast({ variant: 'destructive', title: 'Update Failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (transaction: Transaction) => {
    setDeletingTransaction(transaction);
  };

  const handleConfirmDelete = async () => {
    if (!firestore || !deletingTransaction) return;
    setIsSubmitting(true);

    const transRef = doc(firestore, `transactions/${deletingTransaction.id}`);
    try {
      await deleteDoc(transRef);
      toast({ title: 'Transaction Deleted' });
      setDeletingTransaction(null);
    } catch (error) {
      console.error("Error deleting transaction:", error);
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: transRef.path, operation: 'delete' }));
      toast({ variant: 'destructive', title: 'Deletion Failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const { stats, workItemFinancials, itemsWithTransactions } = useMemo(() => {
    if (!transactions || !workItems) return { 
        stats: { totalBilled: 0, totalPaid: 0, totalOutstanding: 0, totalCredit: 0 }, 
        workItemFinancials: [],
        itemsWithTransactions: []
    };

    let totalDebit = 0;
    let totalCreditInvoice = 0;
    let totalCreditAdvance = 0;

    const financialsMap = new Map<string, { workItem: WorkItem, debit: number, creditInvoice: number, creditAdvance: number }>();
    const itemIdsWithTransactions = new Set<string>();

    transactions.forEach(t => {
      itemIdsWithTransactions.add(t.workItemId);
      if (t.type === 'Debit Invoice') totalDebit += t.amount;
      if (t.type === 'Credit Invoice') totalCreditInvoice += t.amount;
      if (t.type === 'Credit Advance') totalCreditAdvance += t.amount;

      if (!financialsMap.has(t.workItemId)) {
        const workItem = workItems.find(wi => wi.id === t.workItemId);
        if (workItem) {
          financialsMap.set(t.workItemId, { workItem, debit: 0, creditInvoice: 0, creditAdvance: 0 });
        }
      }

      const fin = financialsMap.get(t.workItemId);
      if (fin) {
        if (t.type === 'Debit Invoice') fin.debit += t.amount;
        if (t.type === 'Credit Invoice') fin.creditInvoice += t.amount;
        if (t.type === 'Credit Advance') fin.creditAdvance += t.amount;
      }
    });

    const totalBilled = totalDebit - totalCreditInvoice;
    const totalPaid = totalCreditAdvance;
    const totalOutstanding = totalBilled - totalPaid;
    const totalCredit = totalCreditInvoice + totalCreditAdvance;

    const filteredItems = workItems.filter(item => itemIdsWithTransactions.has(item.id));

    return {
      stats: {
        totalBilled,
        totalPaid,
        totalOutstanding,
        totalCredit
      },
      workItemFinancials: Array.from(financialsMap.values()).sort((a, b) => b.debit - a.debit),
      itemsWithTransactions: filteredItems
    };
  }, [transactions, workItems]);

  const sortedTransactions = useMemo(() => {
      return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-bold">Payment Transactions</h1>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load financial data. Please check your connection.</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-blue-600 uppercase tracking-wider">Total Billed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalBilled)}</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-green-600 uppercase tracking-wider">Total Payment Received</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalPaid)}</div>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 border-purple-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-purple-600 uppercase tracking-wider">Total Credit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalCredit)}</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-red-600 uppercase tracking-wider">Total Outstanding</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{formatCurrency(stats.totalOutstanding)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold">Financial Summary by Case</h2>
            <Card>
                <CardContent className="p-0">
                <Table>
                    <TableHeader>
                    <TableRow className="bg-accent border-b">
                        <TableHead>Case ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Process</TableHead>
                        <TableHead className="text-right">Debit (Billed)</TableHead>
                        <TableHead className="text-right">Credit (Paid/Adj)</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {workItemFinancials.map(({ workItem, debit, creditInvoice, creditAdvance }) => {
                        const billed = debit - creditInvoice;
                        const paid = creditAdvance;
                        const outstanding = billed - paid;
                        const totalCredit = creditInvoice + creditAdvance;

                        return (
                        <TableRow key={workItem.id}>
                            <TableCell className="font-medium">
                            <Link to={`/dashboard/work-item?id=${workItem.id}`} className="hover:underline text-blue-600">
                                {workItem.id}
                            </Link>
                            </TableCell>
                            <TableCell className="text-sm">{workItem.customerName}</TableCell>
                            <TableCell className="text-xs">{workItem.workType}</TableCell>
                            <TableCell className="text-right">{formatCurrency(debit)}</TableCell>
                            <TableCell className="text-right text-green-600">{formatCurrency(totalCredit)}</TableCell>
                            <TableCell className="text-right font-bold text-destructive">
                            {formatCurrency(outstanding)}
                            </TableCell>
                        </TableRow>
                        );
                    })}
                    {workItemFinancials.length === 0 && (
                        <TableRow>
                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                            No financial transactions found.
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold">Work Items with Transactions</h2>
            <WorkItemTable workItems={itemsWithTransactions} users={users} showActions={true} />
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold">Recent Transaction Ledger</h2>
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-accent border-b">
                                <TableHead>Date</TableHead>
                                <TableHead>Case ID</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-center">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedTransactions.map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell className="text-xs">
                                        <ClientFormattedDate date={t.date} formatString="dd-MMM-yyyy" />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <Link to={`/dashboard/work-item?id=${t.workItemId}`} className="hover:underline text-blue-600">
                                            {t.workItemId}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-xs">{t.description}</TableCell>
                                    <TableCell className="text-xs">
                                        <span className={(t.type === 'Credit Advance' || t.type === 'Credit Invoice') ? 'text-green-600' : ''}>
                                            {t.type}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {formatCurrency(t.amount)}
                                    </TableCell>
                                    <TableCell className="text-center py-0">
                                        <div className="flex items-center justify-center gap-1">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditClick(t)}>
                                                <FilePenLine className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(t)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {sortedTransactions.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                        No individual transactions recorded yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Edit Transaction Dialog */}
      <Dialog open={!!editingTransaction} onOpenChange={(open) => !open && setEditingTransaction(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Update the details for transaction {editingTransaction?.id}.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdateTransaction)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Debit Invoice">Debit Invoice</SelectItem>
                        <SelectItem value="Credit Invoice">Credit Invoice</SelectItem>
                        <SelectItem value="Credit Advance">Credit Advance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingTransaction(null)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deletingTransaction} onOpenChange={(open) => !open && setDeletingTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the transaction record for "{deletingTransaction?.description}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingTransaction(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={handleConfirmDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete Transaction'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
