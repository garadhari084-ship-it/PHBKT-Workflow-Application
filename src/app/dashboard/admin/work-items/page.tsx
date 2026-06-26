'use client';

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import WorkItemTable from '@/components/app/work-item-table';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { WorkItem, User, WorkItemStatus } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';


export default function AdminWorkItemsPage() {
  const firestore = useFirestore();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    workType: 'all',
    assignedUserId: 'all',
    status: 'all',
    startDate: '',
    endDate: '',
  });
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const workItemsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'work_items'));
  }, [firestore]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);

  const { data: workItemsData, isLoading: isLoadingWorkItems, error: workItemsError } = useCollection<WorkItem>(workItemsQuery);
  const { data: usersData, isLoading: isLoadingUsers, error: usersError } = useCollection<User>(usersQuery);

  const isLoading = isLoadingWorkItems || isLoadingUsers;
  const error = workItemsError || usersError;
  
  const workItems = workItemsData || [];
  const users = usersData || [];

  const workTypes = ['New Business Request', 'Web & App Development', 'Digital Marketing', 'Tax & Compliance', 'BPO & KPO Services', 'Feedback & Complaint', 'Other Service Request'];
  const statuses: WorkItemStatus[] = ['Open', 'Close', 'Completed', 'Terminated', 'Reindex', 'Transfer', 'Pend'];

  const filteredWorkItems = useMemo(() => {
    return workItems.filter(item => {
      const { workType, assignedUserId, status, startDate, endDate } = filters;
      
      if (workType !== 'all' && item.workType !== workType) return false;
      
      if (assignedUserId !== 'all') {
        if (assignedUserId === 'unassigned') {
          if (item.assignedUserId) return false;
        } else {
          if (item.assignedUserId !== assignedUserId) return false;
        }
      }
      
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
      assignedUserId: 'all',
      status: 'all',
      startDate: '',
      endDate: '',
    });
    setIsPopoverOpen(false);
  };

  return (
    <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto p-4 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-bold">All Work Items</h1>
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
                  <Label htmlFor="assigned" className="text-xs text-right">Assigned</Label>
                   <Select
                    value={filters.assignedUserId}
                    onValueChange={(value) => handleFilterChange('assignedUserId', value)}
                  >
                    <SelectTrigger id="assigned" className="col-span-3 h-6">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id}>{user.firstName} {user.lastName}</SelectItem>
                      ))}
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="status" className="text-xs text-right">Status</Label>
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
