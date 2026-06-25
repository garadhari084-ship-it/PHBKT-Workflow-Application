'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { Customer, WorkItem, Transaction, User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, User as UserIcon, Briefcase, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMemo } from 'react';
import WorkItemTable from '@/components/app/work-item-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ClientFormattedDate from '@/components/app/client-formatted-date';
import Link from 'next/link';

export default function ViewCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const firestore = useFirestore();

  // Fetch Customer
  const customerRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, `customers/${id}`);
  }, [firestore, id]);
  const { data: customer, isLoading: isLoadingCustomer, error: customerError } = useDoc<Customer>(customerRef);

  // Fetch Work Items for this customer
  const workItemsQuery = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return query(collection(firestore, 'work_items'), where('customerId', '==', id));
  }, [firestore, id]);
  const { data: workItems, isLoading: isLoadingWorkItems, error: workItemsError } = useCollection<WorkItem>(workItemsQuery);

  // Fetch Transactions for this customer
  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return query(collection(firestore, 'transactions'), where('customerId', '==', id));
  }, [firestore, id]);
  const { data: transactionsData, isLoading: isLoadingTransactions, error: transactionsError } = useCollection<Transaction>(transactionsQuery);

  const transactions = useMemo(() => {
    if (!transactionsData) return [];
    return [...transactionsData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactionsData]);

  // Fetch all users to pass to WorkItemTable
  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);
  const { data: users, isLoading: isLoadingUsers, error: usersError } = useCollection<User>(usersQuery);

  const { totalBilled, totalPaid, outstandingBalance } = useMemo(() => {
    if (!transactions) return { totalBilled: 0, totalPaid: 0, outstandingBalance: 0 };
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
    return { totalBilled: billed, totalPaid: paid, outstandingBalance: billed - paid };
  }, [transactions]);

  const isLoading = isLoadingCustomer || isLoadingWorkItems || isLoadingTransactions || isLoadingUsers;
  const error = customerError || workItemsError || transactionsError || usersError;

  if (error) {
    return (
      <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load customer details.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!customer) {
    return (
       <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto p-8 text-center">
            <h1 className="text-2xl font-bold">Customer Not Found</h1>
            <p className="text-muted-foreground">The customer with ID "{id}" could not be found.</p>
        </div>
    );
  }
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(amount);
  };

  return (
    <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8">
                <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-2xl font-bold">Customer Details: {customer.name}</h1>
            </div>
            <Button onClick={() => router.push(`/dashboard/admin/manage-customer/edit/${customer.id}`)}>
                Edit Customer
            </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Work Items</CardTitle>
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{workItems?.length ?? 0}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-destructive">{formatCurrency(outstandingBalance)}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
                </CardContent>
            </Card>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><UserIcon className="h-5 w-5 text-primary" /> Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div><strong className="text-muted-foreground">Name:</strong> {customer.name}</div>
                <div><strong className="text-muted-foreground">Email:</strong> {customer.email || 'N/A'}</div>
                <div><strong className="text-muted-foreground">Phone:</strong> {customer.phone}</div>
                <div><strong className="text-muted-foreground">Secondary Phone:</strong> {customer.secondaryPhone || 'N/A'}</div>
                <div><strong className="text-muted-foreground">Address:</strong> {[customer.address, customer.city, customer.state, customer.pinCode].filter(Boolean).join(', ') || 'N/A'}</div>
            </CardContent>
        </Card>

        <div>
            <h2 className="text-xl font-bold mb-4">Work Items</h2>
            <WorkItemTable workItems={workItems || []} users={users || []} />
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>All transactions for {customer.name}</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Work Item</TableHead>
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
                                <TableCell>
                                    <Link href={`/dashboard/work-item/${transaction.workItemId}`} className="hover:underline text-blue-600">
                                        {transaction.workItemId}
                                    </Link>
                                </TableCell>
                                <TableCell>{transaction.description}</TableCell>
                                <TableCell>
                                    <span className={(transaction.type === 'Credit Advance' || transaction.type === 'Credit Invoice') ? 'text-green-600' : ''}>
                                        {transaction.type}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {formatCurrency(transaction.amount)}
                                </TableCell>
                            </TableRow>
                        ))}
                        {transactions.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">
                                    No transactions recorded for this customer.
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
