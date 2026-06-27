'use server';
/**
 * @fileOverview A flow to create a work item from an external source.
 *
 * - createWorkItemFromApi - A function that handles the work item creation process via API.
 * - CreateWorkItemInput - The input type for the createWorkItemFromApi function.
 * - CreateWorkItemOutput - The return type for the createWorkItemFromApi function.
 */

import {ai} from '../genkit';
import {z} from 'genkit';
import { firestore } from '../../firebase-server';
import type { Customer, GlobalNote } from '@/lib/types';

const CreateWorkItemInputSchema = z.object({
  product: z.string().describe('The product or service of interest (e.g., "Web & App Development"). This will be used as the work type.'),
  customerName: z.string().describe('Name of the customer.'),
  customerEmail: z.string().email().optional().describe('Email of the customer.'),
  customerPhone: z.string().describe('Primary phone number of the customer (10 digits).'),
  leadType: z.string().optional().describe('The source of the lead (e.g., "Website Form").'),
  city: z.string().optional().describe('City of the customer.'),
  businessName: z.string().optional().describe("Name of the customer's business."),
  tasks: z.array(z.string()).optional().describe('A list of tasks for the work item.'),
  assignedUserId: z.string().optional().describe('The ID of the user to assign the work item to. If not provided, it will be unassigned.'),
  creatorId: z.string().optional().describe('The ID of the user creating this, if coming from within the app. Defaults to "api-user".')
});
export type CreateWorkItemInput = z.infer<typeof CreateWorkItemInputSchema>;

const CreateWorkItemOutputSchema = z.object({
  workItemId: z.string().describe('The ID of the newly created work item.'),
  customerId: z.string().describe('The ID of the customer.'),
  isNewCustomer: z.boolean().describe('Whether a new customer was created.'),
});
export type CreateWorkItemOutput = z.infer<typeof CreateWorkItemOutputSchema>;

const getWorkTypePrefix = (workType: string): string => {
    switch (workType) {
        case 'New Business Request': return 'NB';
        case 'Web & App Development': return 'DS';
        case 'Digital Marketing': return 'DM';
        case 'Tax & Compliance': return 'TC';
        case 'BPO & KPO Services': return 'BPO';
        case 'Feedback & Complaint': return 'FC';
        case 'Other Service Request': return 'OSR';
        default: return 'WI';
    }
};

const generateCustomerUID = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};


const createWorkItemFlow = ai.defineFlow(
  {
    name: 'createWorkItemFlow',
    inputSchema: CreateWorkItemInputSchema,
    outputSchema: CreateWorkItemOutputSchema,
  },
  async (input) => {
    if (!firestore) {
        throw new Error('Firestore is not initialized. Check your environment variables.');
    }
    
    const {
        product,
        leadType,
        customerName,
        customerEmail,
        customerPhone,
        city,
        businessName,
        tasks,
        assignedUserId,
        creatorId
    } = input;
    
    const workType = product;
    const description = product;

    const fullPhoneNumber = customerPhone.startsWith('+91') ? customerPhone : `+91${customerPhone}`;
    
    let customerId: string;
    let isNewCustomer = false;

    const customersRef = firestore.collection("customers");
    const q = customersRef.where("phone", "==", fullPhoneNumber);
    const customerQuerySnapshot = await q.get();

    if (customerQuerySnapshot.empty) {
        isNewCustomer = true;
        customerId = generateCustomerUID();
    } else {
        customerId = customerQuerySnapshot.docs[0].id;
    }

    const newWorkItemId = await firestore.runTransaction(async (transaction) => {
        const prefix = getWorkTypePrefix(workType);
        const counterId = `work_items_${prefix}`;
        const counterRef = firestore.doc(`counters/${counterId}`);
        const counterDoc = await transaction.get(counterRef);

        const newCount = counterDoc.exists ? (counterDoc.data()?.value || 0) + 1 : 1;
        const numericId = String(newCount).padStart(7, '0');
        const customId = `${prefix}-${numericId}`;

        const newWorkItemRef = firestore.collection('work_items').doc(customId);
        
        const newWorkItemData = {
          id: customId,
          subject: workType,
          workType: workType,
          status: 'Open',
          priority: 'Medium',
          createdDate: new Date().toISOString(),
          inboundMethod: 'API',
          assignedUserId: assignedUserId || '',
          createdBy: creatorId || 'api-user',
          lastUpdatedDate: new Date().toISOString(),
          slaDueDate: new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          customerId: customerId,
          customerName: customerName,
          customerEmail: customerEmail || '',
          customerPhone: fullPhoneNumber,
          city: city || '',
          businessName: businessName || '',
          hasBusiness: !!businessName,
          description: description,
          tasks: tasks || [],
          overview: [description],
          leadType: leadType || ''
        };
        
        transaction.set(newWorkItemRef, newWorkItemData);

        if (isNewCustomer) {
            const newCustomerRef = firestore.doc(`customers/${customerId}`);
            const newCustomerData: Partial<Customer> = {
                id: customerId,
                name: customerName,
                email: customerEmail || "",
                phone: fullPhoneNumber,
                city: city || '',
                createdDate: new Date().toISOString(),
            };
            transaction.set(newCustomerRef, newCustomerData);
        }

        transaction.set(counterRef, { value: newCount });
        return customId;
    });

    if (!isNewCustomer) {
        const globalNotesQuery = firestore.collection("global_notes").where("customerId", "==", customerId);
        const globalNotesSnapshot = await globalNotesQuery.get();
        if (!globalNotesSnapshot.empty) {
            const noteBatch = firestore.batch();
            globalNotesSnapshot.forEach(globalNoteDoc => {
                const globalNoteData = globalNoteDoc.data() as GlobalNote;
                const newNoteRef = firestore.collection(`work_items/${newWorkItemId}/notes`).doc();
                noteBatch.set(newNoteRef, {
                    id: newNoteRef.id, workItemId: newWorkItemId, authorId: globalNoteData.authorId,
                    date: globalNoteData.date, text: globalNoteData.text, category: 'Global Note',
                    subject: globalNoteData.subject || "Imported Global Note", isGlobal: true,
                });
            });
            await noteBatch.commit();
        }
    }

    return {
        workItemId: newWorkItemId,
        customerId,
        isNewCustomer,
    };
  }
);


export async function createWorkItemFromApi(input: CreateWorkItemInput): Promise<CreateWorkItemOutput> {
    return await createWorkItemFlow(input);
}
