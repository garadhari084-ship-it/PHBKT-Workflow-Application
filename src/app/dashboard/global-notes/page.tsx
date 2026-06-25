'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Search } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import type { GlobalNote, User } from '@/lib/types';
import ClientFormattedDate from '@/components/app/client-formatted-date';
import { Skeleton } from '@/components/ui/skeleton';

// Schema for the Add Global Note form
const addNoteSchema = z.object({
  customerId: z.string().min(1, 'Customer Unique ID is required.'),
  workItemId: z.string().optional(),
  subject: z.string().min(1, 'Subject is required.'),
  note: z.string().min(1, 'Note content is required.'),
});

// Component for the Global Notes Page
export default function GlobalNotesPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalNote[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Fetch all users to display names
  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);
  const { data: usersData, isLoading: isLoadingUsers } = useCollection<User>(usersQuery);
  const users = usersData || [];

  const addNoteForm = useForm<z.infer<typeof addNoteSchema>>({
    resolver: zodResolver(addNoteSchema),
    defaultValues: {
      customerId: '',
      workItemId: '',
      subject: '',
      note: '',
    },
  });

  // Handle adding a new global note
  const handleAddNote = async (values: z.infer<typeof addNoteSchema>) => {
    if (!firestore || !user) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
      return;
    }
    setIsSubmittingNote(true);
    try {
      // 1. Create the new global note data
      const newGlobalNoteData = {
        customerId: values.customerId,
        workItemId: values.workItemId || '',
        subject: values.subject,
        text: values.note,
        authorId: user.uid,
        date: new Date().toISOString(),
      };

      // 2. Add the note to the root global_notes collection
      const globalNotesCollection = collection(firestore, 'global_notes');
      await addDoc(globalNotesCollection, newGlobalNoteData);

      // 3. Find all existing work items for this customer
      const workItemsQuery = query(
        collection(firestore, 'work_items'),
        where('customerId', '==', values.customerId)
      );
      const workItemsSnapshot = await getDocs(workItemsQuery);

      // 4. If there are existing work items, copy this global note to each of them
      if (!workItemsSnapshot.empty) {
        const batch = writeBatch(firestore);
        workItemsSnapshot.forEach(workItemDoc => {
          const workItemId = workItemDoc.id;
          const noteForWorkItemRef = doc(collection(firestore, `work_items/${workItemId}/notes`));
          
          const noteData = {
            id: noteForWorkItemRef.id,
            workItemId: workItemId,
            authorId: user.uid,
            date: newGlobalNoteData.date,
            text: newGlobalNoteData.text,
            subject: newGlobalNoteData.subject,
            category: newGlobalNoteData.workItemId || newGlobalNoteData.customerId, // use original reference as category
            isGlobal: true,
          };
          batch.set(noteForWorkItemRef, noteData);
        });
        await batch.commit();
      }

      toast({ title: 'Success', description: 'Global note added and synced with existing work items.' });
      addNoteForm.reset();
    } catch (error) {
      console.error('Error adding global note:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not add the note.' });
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Handle searching for notes
  const handleSearch = async () => {
    if (!firestore || !searchTerm.trim()) {
        setSearchResults([]);
        setHasSearched(true);
        return;
    }
    setIsSearching(true);
    setHasSearched(true);
    setSearchResults([]);

    try {
        const customerId = searchTerm.trim();
        
        const globalNotesCollection = collection(firestore, 'global_notes');
        const notesQuery = query(
            globalNotesCollection, 
            where('customerId', '==', customerId)
        );
        const querySnapshot = await getDocs(notesQuery);
        
        const notes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GlobalNote));
        
        notes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setSearchResults(notes);

    } catch (error) {
      console.error('Error searching notes:', error);
      toast({ variant: 'destructive', title: 'Search Failed', description: 'An error occurred while searching.' });
    } finally {
      setIsSearching(false);
    }
  };

  const getUserName = (authorId: string) => {
    const noteAuthor = users.find(u => u.id === authorId);
    return noteAuthor ? `${noteAuthor.firstName} ${noteAuthor.lastName}`.trim() || noteAuthor.email : 'Unknown';
  };

  return (
    <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column: Add Global Note */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Add Global Note</CardTitle>
              <CardDescription className="text-xs">Add a note associated with a Customer ID.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...addNoteForm}>
                <form onSubmit={addNoteForm.handleSubmit(handleAddNote)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={addNoteForm.control}
                      name="customerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Unique ID *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter Customer ID..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addNoteForm.control}
                      name="workItemId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work Item Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter Work Item Number..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                   <FormField
                      control={addNoteForm.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a subject" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Contact Info">Contact Info</SelectItem>
                              <SelectItem value="DND Do Not Disturb">DND Do Not Disturb</SelectItem>
                              <SelectItem value="Payment">Payment</SelectItem>
                              <SelectItem value="Closing Details">Closing Details</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  <FormField
                    control={addNoteForm.control}
                    name="note"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Note *</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Enter note content..." rows={2} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmittingNote} className="bg-red-600 text-white hover:bg-red-700">
                      {isSubmittingNote ? 'Submitting...' : 'Submit Note'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Search and Results */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Search Customer Notes</CardTitle>
              <CardDescription className="text-xs">
                Find all global notes for a customer by their Unique ID.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Enter Customer ID..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <Button onClick={handleSearch} disabled={isSearching} className="bg-red-600 text-white hover:bg-red-700">
                  {isSearching ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl">Search Results</CardTitle>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Global Note</TableHead>
                    <TableHead className="min-w-[120px] whitespace-nowrap">Customer ID</TableHead>
                    <TableHead className="min-w-[150px] whitespace-nowrap">Work Item Number</TableHead>
                    <TableHead className="min-w-[120px] whitespace-nowrap">Added By</TableHead>
                    <TableHead className="min-w-[120px] whitespace-nowrap">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isSearching || isLoadingUsers ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="space-y-2 py-4">
                          <Skeleton className="h-6 w-full" />
                          <Skeleton className="h-6 w-full" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : hasSearched && searchResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        No global notes found for this customer.
                      </TableCell>
                    </TableRow>
                  ) : (
                    searchResults.map((note) => (
                      <TableRow key={note.id}>
                        <TableCell className="max-w-xs truncate">{note.text}</TableCell>
                        <TableCell>{note.customerId}</TableCell>
                        <TableCell>{note.workItemId || 'N/A'}</TableCell>
                        <TableCell>{getUserName(note.authorId)}</TableCell>
                        <TableCell>
                          <ClientFormattedDate date={note.date} formatString="dd MMM yyyy" />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
