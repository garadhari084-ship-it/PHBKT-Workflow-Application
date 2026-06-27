import { firestore } from "../backend/firebase-server";
import { createWorkItemFromApi } from "../backend/ai/flows/create-work-item-flow";

export default async function handler(req: any, res: any) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS || !firestore) {
      res.status(500).json({ error: "Server missing GOOGLE_APPLICATION_CREDENTIALS or Firebase Admin failed to initialize." });
      return;
    }
    const configRef = firestore.collection("app_config").doc("main");
    const configSnap = await configRef.get();
    const configData = configSnap.data();
    const API_KEY = configData?.externalApiKey;

    const authHeader = req.headers.authorization;
    if (!API_KEY || authHeader !== `Bearer ${API_KEY}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const body = req.body;

    if (!body.customerName || !body.customerEmail || !body.customerPhone || !body.details) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    if (configData?.geminiApiKey) {
      process.env.GEMINI_API_KEY = configData.geminiApiKey;
    }

    const input = {
      product: body.product || body.details,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      city: body.city,
      businessName: body.businessName,
      tasks: body.tasks,
      leadType: body.leadType,
    };

    const result = await createWorkItemFromApi(input);
    return res.status(200).json({ success: true, workItem: result });
  } catch (error: any) {
    console.error("API Route Error:", error);

    const errorDetails = error.message || "";
    if (errorDetails.includes("429 Too Many Requests") || errorDetails.includes("Quota exceeded")) {
      return res.status(429).json({ 
        error: "Rate Limit Exceeded", 
        details: "The free tier limit for the AI model has been reached. Please wait a minute before trying again, or configure your own Gemini API Key in the Admin Panel." 
      });
    }

    return res.status(500).json({ error: "Failed to create work item", details: error.message });
  }
}
