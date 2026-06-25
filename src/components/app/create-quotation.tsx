'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Info, PlusCircle, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { WorkItem } from '@/lib/types';
import { 
    newBusinessRequestTasks, 
    webAndAppTasks, 
    digitalMarketingTasks, 
    taxAndComplianceTasks, 
    bpoAndKpoTasks, 
    feedbackAndComplaintTasks, 
    otherServiceRequestTasks 
} from '@/lib/tasks';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useDoc, useMemoFirebase, useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { addDoc, collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface CreateQuotationProps {
  workItem: WorkItem;
}

type QuotationItem = {
  id: number;
  item: string;
  description: string;
  qty: number;
  unitPrice: number;
};

const QuotationTemplate = ({ workItem, items, quoteNumber, totals, validUntil, quoteDate, logoUrl }: { workItem: Partial<WorkItem>; items: QuotationItem[]; quoteNumber: string; totals: { subtotal: number; total: number }; validUntil: string; quoteDate: string, logoUrl?: string }) => {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    };

    return (
        <div className="bg-white p-8 font-sans relative" style={{ width: '210mm', minHeight: '297mm', color: '#333' }}>
            
            <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                <span>{new Date().toLocaleString('en-GB', { hour12: true })}</span>
                <span>Business Quotation</span>
            </div>

            <div className="h-px bg-gray-200 mb-6"></div>

            <div className="flex justify-between items-start mb-10">
                <div className="flex items-center gap-4">
                    {logoUrl ? (
                         <img src={logoUrl} alt="App Logo" className="h-24 w-auto self-start" />
                    ) : (
                     <svg viewBox="0 0 100 100" className="h-12 w-auto">
                        <path d="M 50,50 L 50,5 A 45,45 0 0 1 88.97,27.5 Z" fill="#c04343"/>
                        <path d="M 50,50 L 88.97,27.5 A 45,45 0 0 1 88.97,72.5 Z" fill="#a52a2a"/>
                        <path d="M 50,50 L 88.97,72.5 A 45,45 0 0 1 50,95 Z" fill="#6f0000"/>
                        <path d="M 50,50 L 50,95 A 45,45 0 0 1 11.03,72.5 Z" fill="#d46a6a"/>
                        <path d="M 50,50 L 11.03,72.5 A 45,45 0 0 1 11.03,27.5 Z" fill="#8a1111"/>
                        <path d="M 50,50 L 11.03,27.5 A 45,45 0 0 1 50,5 Z" fill="#540000"/>
                    </svg>
                    )}
                    <div>
                        <p className="text-xl font-bold">PHBKT Group Limited</p>
                        <p className="text-xs mt-2">North Main Road, Koregaon Park</p>
                        <p className="text-xs">Pune, Maharashtra 414501.</p>
                        <p className="text-xs mt-1">Email: contact@phbkt.com | Phone: +91 7972688626</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-4xl font-bold text-gray-800 tracking-wider">QUOTATION</h2>
                    <p className="text-xs mt-2"><span className="font-bold">Date:</span> {quoteDate}</p>
                    <p className="text-xs"><span className="font-bold">Quote #:</span> {quoteNumber}</p>
                    <p className="text-xs"><span className="font-bold">Valid Until:</span> {validUntil}</p>
                </div>
            </div>

            <div className="mb-8">
                <p className="text-xs text-gray-500 mb-1">Quotation For:</p>
                <p className="text-lg font-bold">{workItem.customerName}</p>
                {workItem.businessName && <p className="text-sm">{workItem.businessName}</p>}
                <p className="text-sm">{[workItem.address, workItem.city, workItem.state, workItem.pinCode].filter(Boolean).join(', ')}</p>
            </div>

            <table className="w-full text-sm mb-8">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="p-2 text-left font-bold text-xs w-[5%]">#</th>
                        <th className="p-2 text-left font-bold text-xs w-[25%]">Item</th>
                        <th className="p-2 text-left font-bold text-xs w-[35%]">Description</th>
                        <th className="p-2 text-right font-bold text-xs w-[10%]">Quantity</th>
                        <th className="p-2 text-right font-bold text-xs w-[15%]">Unit Price (₹)</th>
                        <th className="p-2 text-right font-bold text-xs w-[10%]">Total (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={item.id} className="border-b">
                            <td className="p-2 text-center">{index + 1}</td>
                            <td className="p-2 font-semibold">{item.item}</td>
                            <td className="p-2">{item.description}</td>
                            <td className="p-2 text-right">{item.qty}</td>
                            <td className="p-2 text-right">{formatCurrency(item.unitPrice)}</td>
                            <td className="p-2 text-right font-semibold">{formatCurrency(item.qty * item.unitPrice)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="flex justify-end mb-8">
                <div className="w-2/5 text-sm">
                    <div className="flex justify-between py-2">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-xl py-2 border-t-2 border-gray-600 mt-2">
                        <span>TOTAL:</span>
                        <span>{formatCurrency(totals.total)}</span>
                    </div>
                </div>
            </div>
            
            <div className="absolute bottom-8 left-8 right-8">
                 <div className="mb-12">
                    <h3 className="font-bold text-sm mb-2">Terms & Conditions</h3>
                    <p className="text-xs text-gray-600">50% advance payment is required to start the project.</p>
                    <p className="text-xs text-gray-600">The remaining 50% is due upon project completion, before final delivery.</p>
                    <p className="text-xs text-gray-600">This quotation is valid for 15 days from the date of issue.</p>
                    <p className="text-xs text-gray-600">Any changes or additions to the scope of work may incur additional charges.</p>
                </div>
                <div className="flex justify-between items-start pt-12">
                    <div className="text-center w-2/5">
                        <div className="border-t border-gray-500 pt-2">
                            <p className="text-sm font-semibold">Authorized Signature</p>
                            <p className="text-sm mt-1">PHBKT Group Limited</p>
                        </div>
                    </div>
                    <div className="text-center w-2/5">
                        <div className="border-t border-gray-500 pt-2">
                            <p className="text-sm font-semibold">Client Signature</p>
                            <p className="text-sm mt-1">{workItem.customerName}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


export default function CreateQuotation({ workItem }: CreateQuotationProps) {
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [item, setItem] = useState('');
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const configRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'app_config/main');
  }, [firestore]);

  const { data: config } = useDoc<{logoUrl: string}>(configRef);
  const logoUrl = config?.logoUrl;

  const workTypes = ['New Business Request', 'Web & App Development', 'Digital Marketing', 'Tax & Compliance', 'BPO & KPO Services', 'Feedback & Complaint', 'Other Service Request'];

  const availableTasks = useMemo(() => {
      switch (item) {
          case 'New Business Request': return newBusinessRequestTasks;
          case 'Web & App Development': return webAndAppTasks;
          case 'Digital Marketing': return digitalMarketingTasks;
          case 'Tax & Compliance': return taxAndComplianceTasks;
          case 'BPO & KPO Services': return bpoAndKpoTasks;
          case 'Feedback & Complaint': return feedbackAndComplaintTasks;
          case 'Other Service Request': return otherServiceRequestTasks;
          default: return [];
      }
  }, [item]);

  useEffect(() => {
    setDescription('');
  }, [item]);

  const handleAddItem = () => {
    if (!item || !description || qty <= 0 || unitPrice <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Item', description: 'Please fill all item details correctly.' });
      return;
    }
    const newItem: QuotationItem = {
      id: Date.now(),
      item,
      description,
      qty,
      unitPrice,
    };
    setItems([...items, newItem]);
    // Reset form
    setItem('');
    setDescription('');
    setQty(1);
    setUnitPrice(0);
  };

  const handleDeleteItem = (id: number) => {
    setItems(items.filter(i => i.id !== id));
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, item) => acc + item.qty * item.unitPrice, 0);
    return { subtotal, total: subtotal };
  }, [items]);

  const quoteNumber = `Q-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
  const quoteDate = new Date().toLocaleDateString('en-GB');
  const validUntil = new Date(new Date().setDate(new Date().getDate() + 15)).toLocaleDateString('en-GB');


  const handleGenerateQuotation = async () => {
      if (items.length === 0) {
          toast({ variant: 'destructive', title: 'No items', description: 'Please add at least one item to the quotation.' });
          return;
      }
      if (!firestore || !user) {
          toast({ variant: 'destructive', title: 'Error', description: 'Database not available or user not logged in.' });
          return;
      }
      
      setIsGenerating(true);

      const quotationElement = document.getElementById('quotation-to-print');
      if (!quotationElement) {
          setIsGenerating(false);
          toast({ variant: 'destructive', title: 'Error', description: 'Could not find quotation template to print.' });
          return;
      }

      try {
          const canvas = await html2canvas(quotationElement, { scale: 2 });
          const imgData = canvas.toDataURL('image/png');
          
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          
          pdf.save(`Quotation-${quoteNumber}.pdf`);

          const quotationDataForDb = {
              items: items,
              quoteNumber: quoteNumber,
              totals: totals,
              validUntil: validUntil,
              quoteDate: quoteDate,
              workItem: {
                  customerName: workItem.customerName,
                  businessName: workItem.businessName,
                  address: workItem.address,
                  city: workItem.city,
                  state: workItem.state,
                  pinCode: workItem.pinCode,
              }
          };

          const documentsCollectionRef = collection(firestore, 'work_items', workItem.id, 'documents');
          const newDocument = {
              name: `Quotation-${quoteNumber}.pdf`,
              url: JSON.stringify(quotationDataForDb),
              uploadedAt: new Date().toISOString(),
              uploadedById: user.uid,
              workItemId: workItem.id,
              type: 'QUOTE',
              direction: 'OUTBOUND',
              documentSource: 'MANUAL',
              businessEvent: 'QUOTE_GENERATED',
          };
          
          await addDoc(documentsCollectionRef, newDocument);

          toast({
              title: 'Quotation Generated',
              description: 'The PDF has started downloading and has been attached to this work item.',
          });

      } catch (error) {
          console.error('Error generating or saving quotation:', error);
          const permissionError = new FirestorePermissionError({
              path: `work_items/${workItem.id}/documents`,
              operation: 'create',
              requestResourceData: { name: `Quotation-${quoteNumber}.pdf`, type: 'QUOTE' },
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({ variant: 'destructive', title: 'Generation Failed', description: 'An error occurred while generating the PDF or saving the attachment.' });
      } finally {
          setIsGenerating(false);
      }
  };


  return (
    <>
      <div className="p-4 bg-gray-50/50 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <div className="flex">
            <Card className="w-full border-zinc-400">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                <Info className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Customer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Customer Name</Label>
                    <Input readOnly value={workItem.customerName || ''} className="bg-gray-100 border-zinc-400" />
                  </div>
                  <div>
                    <Label>Customer Phone</Label>
                    <Input readOnly value={workItem.customerPhone?.replace('+91', '') || ''} className="bg-gray-100 border-zinc-400" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>City</Label>
                    <Input readOnly value={workItem.city || ''} className="bg-gray-100 border-zinc-400" />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input readOnly value={workItem.customerEmail || ''} className="bg-gray-100 border-zinc-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex">
            <Card className="w-full border-zinc-400">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                <Info className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Item Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-12 gap-x-2 text-sm font-medium text-muted-foreground">
                      <div className="col-span-3">Item</div>
                      <div className="col-span-3">Description</div>
                      <div className="col-span-2">QTY</div>
                      <div className="col-span-2">Unit Price</div>
                      <div className="col-span-2 text-right">Amount</div>
                  </div>
                  <div className="grid grid-cols-12 gap-x-2 items-center">
                      <div className="col-span-3">
                          <Select value={item} onValueChange={setItem}>
                              <SelectTrigger className="border-zinc-400"><SelectValue placeholder="Select Item" /></SelectTrigger>
                              <SelectContent>
                                  {workTypes.map((wt) => <SelectItem key={wt} value={wt}>{wt}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="col-span-3">
                          <Select value={description} onValueChange={setDescription} disabled={!item}>
                              <SelectTrigger className="border-zinc-400"><SelectValue placeholder="Select Desc" /></SelectTrigger>
                              <SelectContent>
                                  {availableTasks.map((task) => <SelectItem key={task} value={task}>{task}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="col-span-2">
                          <Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="border-zinc-400" />
                      </div>
                      <div className="col-span-2">
                          <Input type="number" placeholder="0" value={unitPrice === 0 ? '' : unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} className="border-zinc-400" />
                      </div>
                      <div className="col-span-2 text-right font-semibold">
                          {formatCurrency(qty * unitPrice)}
                      </div>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" className="bg-green-500 text-white hover:bg-green-600" onClick={handleAddItem}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Item
                    </Button>
                  </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        <Card className="border-zinc-400">
          <CardHeader>
              <CardTitle className="text-lg">Added Items</CardTitle>
          </CardHeader>
          <CardContent>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead className="w-[50px]">#</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-center">QTY</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="w-[50px] text-right"></TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {items.map((addedItem, index) => (
                          <TableRow key={addedItem.id}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{addedItem.item}</TableCell>
                              <TableCell>{addedItem.description}</TableCell>
                              <TableCell className="text-center">{addedItem.qty}</TableCell>
                              <TableCell className="text-right">{formatCurrency(addedItem.unitPrice)}</TableCell>
                              <TableCell className="text-right font-semibold">{formatCurrency(addedItem.qty * addedItem.unitPrice)}</TableCell>
                              <TableCell className="text-right">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteItem(addedItem.id)}>
                                      <Trash2 className="h-4 w-4" />
                                  </Button>
                              </TableCell>
                          </TableRow>
                      ))}
                      {items.length === 0 && (
                          <TableRow>
                              <TableCell colSpan={7} className="text-center h-24">
                                  No items added yet.
                              </TableCell>
                          </TableRow>
                      )}
                  </TableBody>
              </Table>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleGenerateQuotation} disabled={isGenerating} className="bg-red-600 hover:bg-red-700">
            {isGenerating ? 'Generating...' : 'Generate Quotation'}
          </Button>
        </div>

        <div id="quotation-to-print" className="fixed -left-[9999px] top-0">
            <QuotationTemplate 
                workItem={workItem} 
                items={items} 
                quoteNumber={quoteNumber}
                totals={totals}
                validUntil={validUntil}
                quoteDate={quoteDate}
                logoUrl={logoUrl}
            />
        </div>
      </div>
    </>
  );
}
