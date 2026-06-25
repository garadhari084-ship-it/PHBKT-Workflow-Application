'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { User, WorkItem, WorkItemStatus } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { isBefore, parseISO, isPast } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

type UserAnalytics = {
    user: User;
    totalCases: number;
    statusCounts: Record<WorkItemStatus, number>;
    slaMeetCount: number;
    slaNotMeetCount: number;
};

export default function UsersAnalyticsDashboardPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    const [filters, setFilters] = useState({
        userId: 'all',
        workType: 'all',
        startDate: '',
        endDate: '',
    });
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);

    const workItemsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'work_items'));
    }, [firestore]);

    const { data: users, isLoading: isLoadingUsers, error: usersError } = useCollection<User>(usersQuery);
    const { data: workItems, isLoading: isLoadingWorkItems, error: workItemsError } = useCollection<WorkItem>(workItemsQuery);

    const isLoading = isLoadingUsers || isLoadingWorkItems;
    const error = usersError || workItemsError;

    const workTypes = ['New Business Request', 'Web & App Development', 'Digital Marketing', 'Tax & Compliance', 'BPO & KPO Services', 'Feedback & Complaint', 'Other Service Request'];

    const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const clearFilters = () => {
        setFilters({
            userId: 'all',
            workType: 'all',
            startDate: '',
            endDate: '',
        });
        setIsPopoverOpen(false);
    };

    const filteredWorkItems = useMemo(() => {
        if (!workItems) return [];
        return workItems.filter(item => {
            const { userId, workType, startDate, endDate } = filters;
            if (userId !== 'all' && item.assignedUserId !== userId) return false;
            if (workType !== 'all' && item.workType !== workType) return false;
            if (startDate && item.createdDate.substring(0, 10) < startDate) return false;
            if (endDate && item.createdDate.substring(0, 10) > endDate) return false;
            return true;
        });
    }, [workItems, filters]);

    const analyticsData: UserAnalytics[] = useMemo(() => {
        if (!users || !filteredWorkItems) {
            return [];
        }

        const analyticsMap = new Map<string, UserAnalytics>();

        // Initialize map with all users
        users.forEach(user => {
            analyticsMap.set(user.id, {
                user,
                totalCases: 0,
                statusCounts: {
                    Open: 0,
                    Close: 0,
                    Completed: 0,
                    Terminated: 0,
                    Reindex: 0,
                    Transfer: 0,
                    Pend: 0,
                },
                slaMeetCount: 0,
                slaNotMeetCount: 0,
            });
        });

        // Populate stats from filtered work items
        filteredWorkItems.forEach(item => {
            if (item.assignedUserId) {
                const stats = analyticsMap.get(item.assignedUserId);
                if (stats) {
                    stats.totalCases += 1;
                    if (item.status) {
                        stats.statusCounts[item.status] = (stats.statusCounts[item.status] || 0) + 1;
                    }
                    if (item.slaDueDate) {
                        try {
                           if (item.status === 'Completed' && item.lastUpdatedDate) {
                               if (isBefore(parseISO(item.lastUpdatedDate), parseISO(item.slaDueDate))) {
                                   stats.slaMeetCount += 1;
                               } else {
                                   stats.slaNotMeetCount += 1;
                               }
                           } else if (item.status !== 'Completed' && item.status !== 'Terminated') {
                               if (isPast(parseISO(item.slaDueDate))) {
                                   stats.slaNotMeetCount += 1;
                               }
                           }
                       } catch (e) {
                           console.error("Could not parse dates for SLA calculation", item);
                       }
                   }
                }
            }
        });
        
        if (filters.userId !== 'all') {
            return Array.from(analyticsMap.values()).filter(d => d.user.id === filters.userId);
        }
        
        return Array.from(analyticsMap.values());

    }, [users, filteredWorkItems, filters.userId]);
    
    const totals = useMemo(() => {
        const initialTotals = {
            totalCases: 0,
            statusCounts: { Open: 0, Close: 0, Completed: 0, Terminated: 0, Reindex: 0, Transfer: 0, Pend: 0 },
            slaMeetCount: 0,
            slaNotMeetCount: 0,
        };

        if (!analyticsData) return initialTotals;

        return analyticsData.reduce((acc, data) => {
            acc.totalCases += data.totalCases;
            acc.slaMeetCount += data.slaMeetCount;
            acc.slaNotMeetCount += data.slaNotMeetCount;
            for (const status in data.statusCounts) {
                acc.statusCounts[status as WorkItemStatus] += data.statusCounts[status as WorkItemStatus];
            }
            return acc;
        }, initialTotals);

    }, [analyticsData]);

    const getUserName = (userId: string | undefined): string => {
        if (!users || !userId) return 'Unassigned';
        const user = users.find(u => u.id === userId);
        if (!user) return 'Unassigned';
        return user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.name || user.email);
    };

    const getSlaMetStatus = (item: WorkItem): 'Yes' | 'No' | 'N/A' => {
        if (!item.slaDueDate) {
            return 'N/A';
        }
        try {
            const dueDate = parseISO(item.slaDueDate);

            if (item.status === 'Completed' && item.lastUpdatedDate) {
                const completedDate = parseISO(item.lastUpdatedDate);
                return isBefore(completedDate, dueDate) ? 'Yes' : 'No';
            }

            if (item.status !== 'Completed' && item.status !== 'Terminated') {
                if (isPast(dueDate)) {
                    return 'No';
                }
            }
            return 'N/A';

        } catch (e) {
            console.error("Date parsing error for SLA", item);
            return 'N/A';
        }
    };

    const handleDownload = (userId: string, userName: string) => {
        const userWorkItems = filteredWorkItems.filter(item => item.assignedUserId === userId);
    
        if (userWorkItems.length === 0) {
            toast({
                title: 'No Data',
                description: `No work items found for ${userName} with current filters.`,
            });
            return;
        }
    
        const dataToExport = userWorkItems.map(item => ({
            'Case ID': item.id,
            'Process': item.workType,
            'Status': item.status,
            'Customer Name': item.customerName,
            'Creation Date': new Date(item.createdDate).toLocaleDateString(),
            'SLA Due Date': item.slaDueDate ? new Date(item.slaDueDate).toLocaleDateString() : 'N/A',
            'SLA Met': getSlaMetStatus(item),
        }));
    
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'User Work Items');
        XLSX.writeFile(workbook, `work_items_${userName.replace(' ', '_')}.xlsx`);
    };

    const handleDownloadAll = () => {
        if (!filteredWorkItems || filteredWorkItems.length === 0) {
            toast({
                title: 'No Data',
                description: 'No work items to export with current filters.',
            });
            return;
        }
        const dataToExport = filteredWorkItems.map(item => ({
            'Case ID': item.id,
            'Assigned User': getUserName(item.assignedUserId),
            'Process': item.workType,
            'Status': item.status,
            'Customer Name': item.customerName,
            'Creation Date': new Date(item.createdDate).toLocaleDateString(),
            'SLA Due Date': item.slaDueDate ? new Date(item.slaDueDate).toLocaleDateString() : 'N/A',
            'SLA Met': getSlaMetStatus(item),
        }));
    
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'User Analytics Report');
        XLSX.writeFile(workbook, `user_analytics_report.xlsx`);
    };

    if (error) {
        return (
            <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>Failed to load analytics data. Please check your connection and try again.</AlertDescription>
                </Alert>
            </div>
        );
    }
    
    const statusColumns: WorkItemStatus[] = ['Open', 'Completed', 'Terminated', 'Pend', 'Reindex', 'Transfer'];


    return (
        <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8">
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Users Analytics Dashboard</h1>
                        <p className="text-sm text-muted-foreground">A pivot view of cases assigned to users by status.</p>
                    </div>
                </div>
                 <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="icon">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-96" align="end">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                            <h4 className="font-semibold leading-none text-xs">Filter Analytics</h4>
                            <p className="text-xs text-muted-foreground">
                                Apply filters to the analytics data.
                            </p>
                            </div>
                            <div className="grid gap-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="user" className="text-xs text-right">User</Label>
                                <Select
                                    value={filters.userId}
                                    onValueChange={(value) => handleFilterChange('userId', value)}
                                >
                                <SelectTrigger id="user" className="col-span-3 h-6">
                                    <SelectValue placeholder="Select a user" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Users</SelectItem>
                                    {users?.map(user => (
                                        <SelectItem key={user.id} value={user.id}>{user.firstName} {user.lastName}</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="process" className="text-xs text-right">Process</Label>
                                <Select
                                value={filters.workType}
                                onValueChange={(value) => handleFilterChange('workType', value)}
                                >
                                <SelectTrigger id="process" className="col-span-3 h-6">
                                    <SelectValue placeholder="Select a process" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    {workTypes.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="start-date" className="text-xs text-right">Date Range</Label>
                                <div className="col-span-3 grid grid-cols-2 gap-2">
                                <Input
                                    id="start-date"
                                    type="date"
                                    value={filters.startDate}
                                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                    className="h-6 w-full"
                                />
                                <Input
                                    id="end-date"
                                    type="date"
                                    value={filters.endDate}
                                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                    className="h-6 w-full"
                                />
                                </div>
                            </div>
                            </div>
                            <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={clearFilters} className="h-6 rounded-md px-3 text-xs">Clear</Button>
                            <Button onClick={() => setIsPopoverOpen(false)} className="h-6 rounded-md px-3 text-xs">Apply</Button>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-4 space-y-2">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User Name</TableHead>
                                    {statusColumns.map(status => (
                                        <TableHead key={status} className="text-center">{status}</TableHead>
                                    ))}
                                    <TableHead className="text-center">SLA Meet</TableHead>
                                    <TableHead className="text-center">SLA Not Meet</TableHead>
                                    <TableHead className="text-right">Total Cases</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analyticsData.map(({ user, totalCases, statusCounts, slaMeetCount, slaNotMeetCount }) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.firstName} {user.lastName}</TableCell>
                                        {statusColumns.map(status => (
                                            <TableCell key={status} className="text-center">
                                                {statusCounts[status] > 0 ? statusCounts[status] : '-'}
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-center font-bold text-green-600">{slaMeetCount > 0 ? slaMeetCount : '-'}</TableCell>
                                        <TableCell className="text-center font-bold text-destructive">{slaNotMeetCount > 0 ? slaNotMeetCount : '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                variant="link" 
                                                className="font-bold p-0 h-auto"
                                                onClick={() => handleDownload(user.id, `${user.firstName}_${user.lastName}`)}
                                                disabled={totalCases === 0}
                                            >
                                                {totalCases}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {analyticsData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={statusColumns.length + 4} className="text-center h-24">
                                            No data to display.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                             <TableFooter>
                                <TableRow className="font-bold bg-accent">
                                    <TableCell>Total</TableCell>
                                    {statusColumns.map(status => (
                                        <TableCell key={status} className="text-center">{totals.statusCounts[status] > 0 ? totals.statusCounts[status] : '-'}</TableCell>
                                    ))}
                                    <TableCell className="text-center text-green-600">{totals.slaMeetCount > 0 ? totals.slaMeetCount : '-'}</TableCell>
                                    <TableCell className="text-center text-destructive">{totals.slaNotMeetCount > 0 ? totals.slaNotMeetCount : '-'}</TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                            variant="link" 
                                            className="font-bold p-0 h-auto"
                                            onClick={handleDownloadAll}
                                            disabled={totals.totalCases === 0}
                                        >
                                            {totals.totalCases}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
