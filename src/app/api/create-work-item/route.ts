import { NextRequest, NextResponse } from 'next/server';
import { createWorkItemFromApi } from '@/ai/flows/create-work-item-flow';
import type { CreateWorkItemInput } from '@/ai/flows/create-work-item-flow';
import { firestore } from '@/firebase/server';


export async function POST(req: NextRequest) {
    // Fetch API Key from Firestore
    const configRef = firestore.collection('app_config').doc('main');
    const configSnap = await configRef.get();
    const configData = configSnap.data();
    const API_KEY = configData?.externalApiKey;

    const authHeader = req.headers.get('Authorization');
    if (!API_KEY || authHeader !== `Bearer ${API_KEY}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();

        // It's good practice to validate the input against a schema here as well,
        // even though the flow does it. This provides an earlier failure point.
        const workItemData: CreateWorkItemInput = body;

        const result = await createWorkItemFromApi(workItemData);

        return NextResponse.json(result, { status: 201 });
    } catch (error: any) {
        console.error('API Error creating work item:', error);
        
        let errorMessage = 'An internal server error occurred.';
        let statusCode = 500;
        
        if (error.name === 'ZodError') {
            errorMessage = 'Invalid input data.';
            statusCode = 400;
        } else if (error.message) {
            errorMessage = error.message;
        }

        return NextResponse.json({ error: errorMessage }, { status: statusCode });
    }
}
