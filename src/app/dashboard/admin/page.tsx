'use client';

import { useRouter } from 'next/navigation';
import { Briefcase, Users, Upload, FolderMinus, FilePlus, Contact, BarChart2, Link as LinkIcon, Webhook, CheckCircle, IndianRupee } from 'lucide-react';
import { Card, CardContent, CardTitle, CardHeader, CardDescription } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { User, WorkItem, Customer } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function AdminPage() {
  const router = useRouter();
  const firestore = useFirestore();

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  const workItemsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'work_items');
  }, [firestore]);

  const customersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'customers');
  }, [firestore]);

  const { data: usersData, isLoading: isLoadingUsers } = useCollection<User>(usersQuery);
  const { data: workItemsData, isLoading: isLoadingWorkItems } = useCollection<WorkItem>(workItemsQuery);
  const { data: customersData, isLoading: isLoadingCustomers } = useCollection<Customer>(customersQuery);

  const usersCount = usersData?.length ?? 0;
  const workItemsCount = workItemsData?.length ?? 0;
  const customersCount = customersData?.length ?? 0;
  
  const unassignedWorkItemsCount = useMemo(() => {
    if (!workItemsData) return 0;
    return workItemsData.filter(item => !item.assignedUserId).length;
  }, [workItemsData]);

  const webLeadWorkItemsCount = useMemo(() => {
    if (!workItemsData) return 0;
    return workItemsData.filter(item => item.inboundMethod === 'API').length;
  }, [workItemsData]);

  const completedWorkItemsCount = useMemo(() => {
    if (!workItemsData) return 0;
    return workItemsData.filter(item => item.status === 'Completed').length;
  }, [workItemsData]);

  const isLoading = isLoadingUsers || isLoadingWorkItems || isLoadingCustomers;

  // Chart Data Processing
  const { processData, statusData } = useMemo(() => {
    if (!workItemsData) return { processData: [], statusData: [] };

    // Process breakdown
    const processCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};

    workItemsData.forEach(item => {
      processCounts[item.workType] = (processCounts[item.workType] || 0) + 1;
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    });

    const pData = Object.entries(processCounts)
      .map(([name, count]) => ({ name: name.split(' ')[0], full: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5

    const sData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    return { processData: pData, statusData: sData };
  }, [workItemsData]);

  const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

  return (
    <div className="w-full bg-muted/20 flex-1 overflow-y-auto py-6 px-4 md:px-8 space-y-8 pb-16">
      <div className="flex flex-col space-y-1 fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Overview</h1>
        <p className="text-muted-foreground">Monitor and manage your organization's workflow ecosystem.</p>
      </div>
      
      {/* Overview Analytics row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card 
            className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-primary/10 hover:border-primary relative overflow-hidden bg-card/60 backdrop-blur-sm"
            onClick={() => router.push('/dashboard/admin/users')}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <CardContent className="p-6 flex items-start gap-4">
                <div className="bg-primary/10 text-primary rounded-xl p-3 group-hover:scale-110 transition-transform duration-300">
                    <Users className="h-6 w-6" />
                </div>
                <div>
                    <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">Manage Users</h3>
                    <p className="text-sm text-muted-foreground/80 line-clamp-2">
                        View, create, and manage user accounts and roles.
                    </p>
                </div>
            </CardContent>
            <div className="absolute top-4 right-4 bg-primary/10 text-primary rounded-full h-8 w-8 flex items-center justify-center text-sm font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                {isLoading ? <Skeleton className="h-4 w-4 rounded-full bg-primary/20" /> : usersCount}
            </div>
        </Card>
        <Card 
            className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-primary/10 hover:border-primary relative overflow-hidden bg-card/60 backdrop-blur-sm"
            onClick={() => router.push('/dashboard/admin/work-items')}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <CardContent className="p-6 flex items-start gap-4">
                <div className="bg-primary/10 text-primary rounded-xl p-3 group-hover:scale-110 transition-transform duration-300">
                    <Briefcase className="h-6 w-6" />
                </div>
                <div>
                    <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">Work Items</h3>
                    <p className="text-sm text-muted-foreground/80 line-clamp-2">
                        View, filter, and manage all work items in the system.
                    </p>
                </div>
            </CardContent>
             <div className="absolute top-4 right-4 bg-primary/10 text-primary rounded-full h-8 w-8 flex items-center justify-center text-sm font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                {isLoading ? <Skeleton className="h-4 w-4 rounded-full bg-primary/20" /> : workItemsCount}
            </div>
        </Card>
        <Card 
            className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-primary/10 hover:border-primary relative overflow-hidden bg-card/60 backdrop-blur-sm"
            onClick={() => router.push('/dashboard/admin/unassigned-work-items')}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent pointer-events-none" />
            <CardContent className="p-6 flex items-start gap-4">
                <div className="bg-destructive/10 text-destructive rounded-xl p-3 group-hover:scale-110 transition-transform duration-300">
                    <FolderMinus className="h-6 w-6" />
                </div>
                <div>
                    <h3 className="font-semibold text-lg mb-1 group-hover:text-destructive transition-colors">Unassigned</h3>
                    <p className="text-sm text-muted-foreground/80 line-clamp-2">
                        View and assign work items from the queue.
                    </p>
                </div>
            </CardContent>
             <div className="absolute top-4 right-4 bg-destructive/10 text-destructive rounded-full h-8 w-8 flex items-center justify-center text-sm font-bold group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors duration-300">
                {isLoading ? <Skeleton className="h-4 w-4 rounded-full bg-destructive/20" /> : unassignedWorkItemsCount}
            </div>
        </Card>
        <Card 
            className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-primary/10 hover:border-primary relative overflow-hidden bg-card/60 backdrop-blur-sm"
            onClick={() => router.push('/dashboard/admin/completed-work')}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
            <CardContent className="p-6 flex items-start gap-4">
                <div className="bg-green-500/10 text-green-600 rounded-xl p-3 group-hover:scale-110 transition-transform duration-300">
                    <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                    <h3 className="font-semibold text-lg mb-1 group-hover:text-green-600 transition-colors">Completed</h3>
                    <p className="text-sm text-muted-foreground/80 line-clamp-2">
                        Review all successfully completed workflows.
                    </p>
                </div>
            </CardContent>
             <div className="absolute top-4 right-4 bg-green-500/10 text-green-600 rounded-full h-8 w-8 flex items-center justify-center text-sm font-bold group-hover:bg-green-600 group-hover:text-white transition-colors duration-300">
                {isLoading ? <Skeleton className="h-4 w-4 rounded-full bg-green-500/20" /> : completedWorkItemsCount}
            </div>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-primary/10 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Top Processes Volume</CardTitle>
            <CardDescription>Breakdown of workflow usage by top 5 types.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
               <Skeleton className="h-[250px] w-full rounded-xl" />
            ) : processData.length > 0 ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={processData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="count" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/10 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Work Items Pipeline</CardTitle>
            <CardDescription>Current distribution of statuses across all items.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
               <Skeleton className="h-[250px] w-full rounded-xl" />
            ) : statusData.length > 0 ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Pie
                      data={statusData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-4 mt-2">
                  {statusData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center text-xs">
                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-muted-foreground font-medium">{entry.name} ({entry.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Administrative Tools */}
      <h2 className="text-xl font-bold tracking-tight text-foreground mt-8 mb-4">Operations & Settings</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card
            className="group cursor-pointer hover:shadow-md transition-all duration-300 hover:border-primary/50"
            onClick={() => router.push('/dashboard/admin/payment-transactions')}
        >
            <CardContent className="p-5 flex items-center gap-4">
                <div className="bg-muted p-2 rounded-lg group-hover:bg-primary/10 transition-colors">
                    <IndianRupee className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                    <CardTitle className="text-sm font-semibold group-hover:text-primary transition-colors">Financials</CardTitle>
                    <p className="text-xs text-muted-foreground">Transactions & balances</p>
                </div>
            </CardContent>
        </Card>
        
        <Card
            className="group cursor-pointer hover:shadow-md transition-all duration-300 hover:border-primary/50"
            onClick={() => router.push('/dashboard/admin/manage-customer')}
        >
            <CardContent className="p-5 flex items-center gap-4">
                <div className="bg-muted p-2 rounded-lg group-hover:bg-primary/10 transition-colors">
                    <Contact className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                    <CardTitle className="text-sm font-semibold group-hover:text-primary transition-colors">Customers</CardTitle>
                    <p className="text-xs text-muted-foreground">Profiles & CRM</p>
                </div>
            </CardContent>
        </Card>

        <Card
            className="group cursor-pointer hover:shadow-md transition-all duration-300 hover:border-primary/50"
            onClick={() => router.push('/dashboard/admin/batch-work-item-create')}
        >
            <CardContent className="p-5 flex items-center gap-4">
                <div className="bg-muted p-2 rounded-lg group-hover:bg-primary/10 transition-colors">
                    <FilePlus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                    <CardTitle className="text-sm font-semibold group-hover:text-primary transition-colors">Batch Upload</CardTitle>
                    <p className="text-xs text-muted-foreground">Excel mass imports</p>
                </div>
            </CardContent>
        </Card>

        <Card
            className="group cursor-pointer hover:shadow-md transition-all duration-300 hover:border-primary/50"
            onClick={() => router.push('/dashboard/admin/users-analytics')}
        >
            <CardContent className="p-5 flex items-center gap-4">
                <div className="bg-muted p-2 rounded-lg group-hover:bg-primary/10 transition-colors">
                    <BarChart2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                    <CardTitle className="text-sm font-semibold group-hover:text-primary transition-colors">Team Analytics</CardTitle>
                    <p className="text-xs text-muted-foreground">Performance SLAs</p>
                </div>
            </CardContent>
        </Card>

        <Card
            className="group cursor-pointer hover:shadow-md transition-all duration-300 hover:border-primary/50"
            onClick={() => router.push('/dashboard/admin/api-integration')}
        >
            <CardContent className="p-5 flex items-center gap-4">
                <div className="bg-muted p-2 rounded-lg group-hover:bg-primary/10 transition-colors">
                    <LinkIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                    <CardTitle className="text-sm font-semibold group-hover:text-primary transition-colors">API Keys</CardTitle>
                    <p className="text-xs text-muted-foreground">Webhook credentials</p>
                </div>
            </CardContent>
        </Card>

        <Card
            className="group cursor-pointer hover:shadow-md transition-all duration-300 hover:border-primary/50"
            onClick={() => router.push('/dashboard/admin/web-lead-work-items')}
        >
            <CardContent className="p-5 flex items-center gap-4">
                <div className="bg-muted p-2 rounded-lg group-hover:bg-primary/10 transition-colors">
                    <Webhook className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                    <CardTitle className="text-sm font-semibold group-hover:text-primary transition-colors">Web Leads</CardTitle>
                    <p className="text-xs text-muted-foreground">API inbound items</p>
                </div>
            </CardContent>
        </Card>

        <Card
            className="group cursor-pointer hover:shadow-md transition-all duration-300 hover:border-primary/50 md:col-span-2 lg:col-span-2"
            onClick={() => router.push('/dashboard/admin/application-updates')}
        >
            <CardContent className="p-5 flex items-center gap-4">
                <div className="bg-muted p-2 rounded-lg group-hover:bg-primary/10 transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                    <CardTitle className="text-sm font-semibold group-hover:text-primary transition-colors">App Settings</CardTitle>
                    <p className="text-xs text-muted-foreground">Update global logos and configuration</p>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
