'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { WorkItem, Transaction } from "@/lib/types";
import { PlusCircle, ChevronDown } from 'lucide-react';
import ClientFormattedDate from './client-formatted-date';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

const transactionSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  type: z.enum(['Debit Invoice', 'Credit Advance']),
  amount: z.preprocess(
    (a) => parseFloat(z.string().parse(a)),
    z.number().positive('Amount must be a positive number.')
  ),
});

interface AgencyDetailsProps {
    workItem: WorkItem;
    transactions: Transaction[];
}

export default function AgencyDetails({ workItem, transactions }: AgencyDetailsProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof transactionSchema>>({
        resolver: zodResolver(transactionSchema),
        defaultValues: {
            description: '',
            type: 'Debit Invoice',
            amount: 0,
        }
    });

    const descriptionOptions = [
        'Web & App Development',
        'Digital Marketing',
        'Tax & Compliance',
        'BPO & KPO Services'
    ];

    const { totalBilled, totalPaid, outstandingBalance } = useMemo(() => {
        const debitInvoices = transactions
            .filter(t => t.type === 'Debit Invoice')
            .reduce((acc, t) => acc + t.amount, 0);
        const creditInvoices = transactions
            .filter(t => t.type === 'Credit Invoice')
            .reduce((acc, t) => acc + t.amount, 0);
        
        const billed = debitInvoices - creditInvoices;

        const paid = transactions
            .filter(t => t.type === 'Credit Advance')
            .reduce((acc, t) => acc + t.amount, 0);
        
        return {
            totalBilled: billed,
            totalPaid: paid,
            outstandingBalance: billed - paid
        };
    }, [transactions]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
        }).format(amount);
    };

    const handleAddTransaction = async (values: z.infer<typeof transactionSchema>) => {
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
            return;
        }

        if (!workItem.id || !workItem.customerId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Required identifiers are missing from this work item.' });
            return;
        }

        setIsSubmitting(true);

        const batch = writeBatch(firestore);
        const transactionsRef = collection(firestore, 'transactions');
        const newTransactionRef = doc(transactionsRef);
        
        const typeLabel = values.type === 'Debit Invoice' ? 'Total Bill' : 'Total Paid';
        const formattedAmount = formatCurrency(values.amount);

        const newTransactionData = {
            id: newTransactionRef.id,
            customerId: workItem.customerId,
            workItemId: workItem.id,
            date: new Date().toISOString(),
            description: values.description,
            type: values.type,
            amount: values.amount,
            createdById: user.uid,
        };

        const notesRef = collection(firestore, 'work_items', workItem.id, 'notes');
        const newNoteRef = doc(notesRef);
        const newNoteData = {
            id: newNoteRef.id,
            workItemId: workItem.id,
            authorId: user.uid,
            date: new Date().toISOString(),
            text: `Payment entry added: ${values.description}. Type: ${typeLabel}. Amount: ${formattedAmount}.`,
            category: 'Payment',
            subject: 'Transaction Recorded',
        };

        try {
            batch.set(newTransactionRef, newTransactionData);
            batch.set(newNoteRef, newNoteData);
            
            await batch.commit();
            
            toast({ title: 'Success', description: 'Transaction added and recorded in notes.' });
            form.reset({ description: '', type: 'Debit Invoice', amount: 0 });
        } catch (error) {
            console.error('Error adding transaction:', error);
            const permissionError = new FirestorePermissionError({
                path: 'transactions/notes',
                operation: 'create',
                requestResourceData: { transaction: newTransactionData, note: newNoteData },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not add transaction.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalBilled)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">{formatCurrency(outstandingBalance)}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Add New Transaction</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={form.handleSubmit(handleAddTransaction)} className="flex items-end gap-2">
                        <div className="grid gap-2 w-full" style={{ gridTemplateColumns: '3fr 1fr 1fr' }}>
                            <div className="space-y-1">
                                <label className="text-xs font-medium">Description</label>
                                <div className="flex gap-1">
                                    <Input {...form.register('description')} placeholder="e.g., Initial Invoice" className="flex-grow" />
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 border-input">
                                                <ChevronDown className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-[250px]">
                                            <div className="p-1">
                                                <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">Select Option</p>
                                                {descriptionOptions.map((opt) => (
                                                    <DropdownMenuItem 
                                                        key={opt} 
                                                        onSelect={() => form.setValue('description', opt, { shouldValidate: true })}
                                                        className="text-xs"
                                                    >
                                                        {opt}
                                                    </DropdownMenuItem>
                                                ))}
                                            </div>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
                            </div>
                             <div className="space-y-1">
                                <label className="text-xs font-medium">Type</label>
                                <Select onValueChange={(value: 'Debit Invoice' | 'Credit Advance') => form.setValue('type', value)} defaultValue={form.getValues('type')}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Debit Invoice">Total Bill</SelectItem>
                                        <SelectItem value="Credit Advance">Total Paid</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium">Amount</label>
                                <Input type="number" {...form.register('amount')} placeholder="0.00" />
                                {form.formState.errors.amount && <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>}
                            </div>
                        </div>
                        <Button type="submit" disabled={isSubmitting}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            {isSubmitting ? 'Adding...' : 'Add'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map((transaction) => (
                                <TableRow key={transaction.id}>
                                    <TableCell>
                                      <ClientFormattedDate date={transaction.date} formatString="dd-MMM-yyyy" />
                                    </TableCell>
                                    <TableCell>{transaction.description}</TableCell>
                                    <TableCell>
                                        <span className={(transaction.type === 'Credit Advance' || transaction.type === 'Credit Invoice') ? 'text-green-600' : ''}>
                                            {transaction.type === 'Debit Invoice' ? 'Total Bill' : transaction.type === 'Credit Advance' ? 'Total Paid' : transaction.type}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {formatCurrency(transaction.amount)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {transactions.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24">
                                        No transactions recorded yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}