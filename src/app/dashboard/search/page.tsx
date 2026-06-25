'use client';

import { useState } from 'react';
import { Search as SearchIcon, AlertCircle } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import type { WorkItem, User } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import WorkItemTable from '@/components/app/work-item-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SearchPage() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<WorkItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchType, setSearchType] = useState('caseId');

  // Fetch all users to display assigned user names in the table
  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);
  const { data: usersData, isLoading: isLoadingUsers, error: usersError } = useCollection<User>(usersQuery);
  const users = usersData || [];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !searchTerm.trim()) {
      setSearchResults([]);
      setHasSearched(true);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    setSearchResults([]);

    const term = searchTerm.trim();
    
    try {
      let matches: WorkItem[] = [];

      if (searchType === 'caseId') {
        // Direct document lookup (O(1) highly efficient)
        const docRef = doc(firestore, 'work_items', term);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          matches.push({ ...(docSnap.data() as WorkItem), id: docSnap.id });
        }
      } else {
        // Build efficient query instead of pulling all docs to client memory
        let q;
        const workItemsRef = collection(firestore, 'work_items');
        
        switch (searchType) {
          case 'email':
            q = query(workItemsRef, where('customerEmail', '==', term.toLowerCase()));
            break;
          case 'phone':
            const normalizedPhone = term.replace(/^\+91/, '');
            // Attempt exact matches
            q = query(workItemsRef, where('customerPhone', '==', normalizedPhone));
            break;
          case 'customerId':
            q = query(workItemsRef, where('customerId', '==', term));
            break;
          default:
            throw new Error('Invalid search type');
        }

        const querySnapshot = await getDocs(q);
        const customerMatches = querySnapshot.docs.map(doc => ({ ...(doc.data() as WorkItem), id: doc.id }));

        if (customerMatches.length > 0) {
          const customerIds = new Set(customerMatches.map(item => item.customerId).filter((id): id is string => !!id));
          
          if (customerIds.size > 0 && searchType !== 'customerId') {
             // If we found the user by email/phone, fetch ALL their related work items efficiently using `in`
             const uniqueCustomerIds = Array.from(customerIds).slice(0, 10); // Firestore `in` max 10
             if(uniqueCustomerIds.length > 0) {
               const relatedQ = query(workItemsRef, where('customerId', 'in', uniqueCustomerIds));
               const relatedSnap = await getDocs(relatedQ);
               matches = relatedSnap.docs.map(doc => ({ ...(doc.data() as WorkItem), id: doc.id }));
             }
          } else {
             matches = customerMatches;
          }
        }
      }

      setSearchResults(matches);
    } catch (error) {
      console.error("Error searching work items: ", error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClear = () => {
    setSearchTerm('');
    setSearchResults([]);
    setHasSearched(false);
  };

  const renderResults = () => {
    if (usersError) {
      return (
         <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load user data, which is needed for search results. Please check your network connection and try again.
          </AlertDescription>
        </Alert>
      )
    }

    if (isLoading || isLoadingUsers) {
      return (
        <Card className="rounded-lg shadow-md">
            <CardContent className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
            </CardContent>
        </Card>
      );
    }

    if (!hasSearched) {
      return (
        <Card className="rounded-lg shadow-md overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-accent border-b">
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="min-w-[100px] whitespace-nowrap">Case ID</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="min-w-[180px] whitespace-nowrap">Process</TableHead>
                  <TableHead className="min-w-[150px]">Customer Name</TableHead>
                  <TableHead className="min-w-[150px]">Assigned To</TableHead>
                  <TableHead className="min-w-[120px] whitespace-nowrap">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">
                    Enter a search term to begin.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )
    }
    
    if(searchResults.length > 0) {
        return <WorkItemTable workItems={searchResults} users={users} className="text-2xs" />
    }

    return (
        <Card className="rounded-lg shadow-md overflow-hidden">
        <CardContent className="p-0">
            <Table>
            <TableHeader>
                <TableRow className="bg-accent border-b">
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="min-w-[100px] whitespace-nowrap">Case ID</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="min-w-[180px] whitespace-nowrap">Process</TableHead>
                  <TableHead className="min-w-[150px]">Customer Name</TableHead>
                  <TableHead className="min-w-[150px]">Assigned To</TableHead>
                  <TableHead className="min-w-[120px] whitespace-nowrap">Date</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">
                        No work items found.
                    </TableCell>
                </TableRow>
            </TableBody>
            </Table>
        </CardContent>
        </Card>
    )
  }

  return (
    <div className="w-full bg-background flex-1 overflow-y-auto pt-2 px-4 space-y-2 font-calibri-light">
      <div className="space-y-0">
        <h1 className="text-xl font-bold">Search Work Items</h1>
        <p className="text-sm text-muted-foreground">
          Search by Case ID, Email, Phone, or Customer Unique ID.
        </p>
      </div>

      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <Select value={searchType} onValueChange={setSearchType}>
              <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue placeholder="Search by..." />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="caseId">Case ID</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="customerId">Customer ID</SelectItem>
              </SelectContent>
          </Select>
          <div className="relative flex-grow w-full md:w-auto">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Enter search term..."
              className="pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button type="submit" disabled={isLoading || isLoadingUsers} className="bg-red-600 w-full md:w-auto text-white hover:bg-red-700">
              {isLoading || isLoadingUsers ? 'Searching...' : 'Search'}
            </Button>
            <Button type="button" variant="outline" className="w-full md:w-auto" onClick={handleClear}>
              Clear
            </Button>
          </div>
        </div>
      </form>

      <div>
        {renderResults()}
      </div>
    </div>
  );
}
