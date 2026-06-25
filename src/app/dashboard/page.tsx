'use client';

import { useState, useMemo } from 'react';
import WorkItemTable from '@/components/app/work-item-table';
import { Button } from '@/components/ui/button';
import { Filter, AlertCircle } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { WorkItem, User, WorkItemStatus } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const [filters, setFilters] = useState({
    workType: 'all',
    status: 'all',
    startDate: '',
    endDate: '',
  });
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const assignedItemsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'work_items'), 
      where('assignedUserId', '==', user.uid),
      where('status', 'in', ['Open', 'Pend', 'Transfer'])
    );
  }, [firestore, user]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);
  
  const { data: assignedItemsData, isLoading: isLoadingAssigned, error: assignedItemsError } = useCollection<WorkItem>(assignedItemsQuery);
  const { data: usersData, isLoading: isLoadingUsers, error: usersError } = useCollection<User>(usersQuery);

  const isLoading = isUserLoading || isLoadingAssigned || isLoadingUsers;
  const error = assignedItemsError || usersError;

  const workItems = assignedItemsData || [];
  const users = usersData || [];

  const workTypes = ['New Business Request', 'Web & App Development', 'Digital Marketing', 'Tax & Compliance', 'BPO & KPO Services', 'Feedback & Complaint', 'Other Service Request'];
  const statuses: WorkItemStatus[] = ['Open', 'Pend'];

  const filteredWorkItems = useMemo(() => {
    return workItems.filter(item => {
      const { workType, status, startDate, endDate } = filters;
      
      if (workType !== 'all' && item.workType !== workType) return false;
      if (status !== 'all' && item.status !== status) return false;
      
      if (startDate && item.createdDate.substring(0, 10) < startDate) return false;
      if (endDate && item.createdDate.substring(0, 10) > endDate) return false;
      
      return true;
    });
  }, [workItems, filters]);

  const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const clearFilters = () => {
    setFilters({
      workType: 'all',
      status: 'all',
      startDate: '',
      endDate: '',
    });
    setIsPopoverOpen(false);
  };


  if (error) {
    return (
      <div className="w-full bg-background flex-1 overflow-y-auto p-4 space-y-4 font-calibri-light">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load dashboard data. Please check your network connection and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full bg-background flex-1 overflow-y-auto p-4 space-y-4 font-calibri-light">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">My Work</h1>
          <p className="text-sm text-muted-foreground">Work items that are assigned to you.</p>
        </div>
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[calc(100vw-2rem)] sm:w-96" align="end">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold leading-none text-xs">Filter My Work</h4>
                <p className="text-xs text-muted-foreground">
                  Apply filters to your work item list.
                </p>
              </div>
              <div className="grid gap-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="process" className="text-xs">Process</Label>
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
                  <Label htmlFor="status" className="text-xs">Status</Label>
                   <Select
                    value={filters.status}
                    onValueChange={(value) => handleFilterChange('status', value)}
                  >
                    <SelectTrigger id="status" className="col-span-3 h-6">
                      <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {statuses.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="start-date" className="text-xs">Date Range</Label>
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
      {isLoading ? (
        <Card className="rounded-lg shadow-md">
            <CardContent className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
            </CardContent>
        </Card>
      ) : (
        <WorkItemTable 
          workItems={filteredWorkItems} 
          users={users} 
          className="text-base"
        />
      )}
    </div>
  );
}
