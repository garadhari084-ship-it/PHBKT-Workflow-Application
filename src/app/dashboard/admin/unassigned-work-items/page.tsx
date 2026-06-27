'use client';

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WorkItemTable from '@/components/app/work-item-table';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { WorkItem, User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, Download, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function UnassignedWorkItemsPage() {
  const firestore = useFirestore();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    workType: 'all',
    startDate: '',
    endDate: '',
  });
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const workItemsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Query for work items where assignedUserId is not present or is an empty string
    return query(collection(firestore, 'work_items'), where('assignedUserId', '==', ''));
  }, [firestore]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);

  const { data: workItemsData, isLoading: isLoadingWorkItems, error: workItemsError } = useCollection<WorkItem>(workItemsQuery);
  const { data: usersData, isLoading: isLoadingUsers, error: usersError } = useCollection<User>(usersQuery);

  const isLoading = isLoadingWorkItems || isLoadingUsers;
  const error = workItemsError || usersError;
  
  const users = usersData || [];

  const workTypes = ['New Business Request', 'Web & App Development', 'Digital Marketing', 'Tax & Compliance', 'BPO & KPO Services', 'Feedback & Complaint', 'Other Service Request'];

  const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const clearFilters = () => {
    setFilters({
      workType: 'all',
      startDate: '',
      endDate: '',
    });
    setIsPopoverOpen(false);
  };

  const filteredWorkItems = useMemo(() => {
    return (workItemsData || []).filter(item => {
      const { workType, startDate, endDate } = filters;
      
      if (workType !== 'all' && item.workType !== workType) return false;
      
      if (startDate && item.createdDate.substring(0, 10) < startDate) return false;
      if (endDate && item.createdDate.substring(0, 10) > endDate) return false;
      
      return true;
    });
  }, [workItemsData, filters]);

  const handleDownload = () => {
    if (!filteredWorkItems) {
      return;
    }

    const getUserName = (userId: string | undefined) => {
        if (!userId) return 'N/A';
        const user = users.find(u => u.id === userId);
        if (!user) return 'Unknown User';
        return user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.name || user.email);
    };

    const dataToExport = filteredWorkItems.map(item => ({
        'Case ID': item.id,
        'Process': item.workType,
        'Customer Name': item.customerName,
        'Customer Phone': item.customerPhone,
        'Creation Date': new Date(item.createdDate).toLocaleDateString(),
        'Created By': getUserName(item.createdBy),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Unassigned Work');
    XLSX.writeFile(workbook, 'unassigned_work_items.xlsx');
  };

  return (
    <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto px-2 md:px-4 lg:px-6 py-4 md:py-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-bold">New Unassigned Work Items</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={isLoading || !filteredWorkItems || filteredWorkItems.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Download Report
          </Button>
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96" align="end">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold leading-none text-xs">Filter Work Items</h4>
                  <p className="text-xs text-muted-foreground">
                    Apply filters to the work item list.
                  </p>
                </div>
                <div className="grid gap-4">
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
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load data. Please check your network connection and try again.
          </AlertDescription>
        </Alert>
      )}
      {isLoading ? (
        <Card className="rounded-lg shadow-md">
            <CardContent className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
            </CardContent>
        </Card>
      ) : !error && (
        <WorkItemTable 
          workItems={filteredWorkItems} 
          users={users} 
          showActions={true}
        />
      )}
    </div>
  );
}
