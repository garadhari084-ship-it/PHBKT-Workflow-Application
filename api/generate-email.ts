import { generateEmail } from "../backend/ai/flows/generate-email-flow";
import { firestore } from "../backend/firebase-server";

export default async function handler(req: any, res: any) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { geminiApiKey, ...restBody } = req.body;
      
    if (geminiApiKey) {
      process.env.GEMINI_API_KEY = geminiApiKey;
    } else if (!process.env.GEMINI_API_KEY) {
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS && firestore) {
        try {
          const configRef = firestore.collection("app_config").doc("main");
          const configSnap = await configRef.get();
          const configData = configSnap.data();
          if (configData?.geminiApiKey) {
            process.env.GEMINI_API_KEY = configData.geminiApiKey;
          }
        } catch (e) {
          console.warn("Could not fetch config from Firestore", e);
        }
      }
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API Key is not configured. Please add it in the Admin Panel under API Integration or in your environment variables." });
    }

    const result = await generateEmail(restBody);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("API Route Error:", error);
    return res.status(500).json({ error: "Failed to generate email", details: error.message, stack: error.stack });
  }
}
