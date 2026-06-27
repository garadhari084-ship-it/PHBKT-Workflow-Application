import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { firestore } from "./backend/firebase-server";
import { createWorkItemFromApi } from "./backend/ai/flows/create-work-item-flow";
import { generateEmail } from "./backend/ai/flows/generate-email-flow";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoints
  app.post("/api/create-work-item", async (req, res) => {
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
      res.status(200).json({ success: true, workItem: result });
    } catch (error: any) {
      console.error("API Route Error:", error);
      
      const errorDetails = error.message || "";
      if (errorDetails.includes("429 Too Many Requests") || errorDetails.includes("Quota exceeded")) {
        res.status(429).json({ 
          error: "Rate Limit Exceeded", 
          details: "The free tier limit for the AI model has been reached. Please wait a minute before trying again, or configure your own Gemini API Key in the Admin Panel." 
        });
        return;
      }
      
      res.status(500).json({ error: "Failed to create work item", details: error.message });
    }
  });

  app.post("/api/generate-email", async (req, res) => {
    try {
      const { geminiApiKey, ...restBody } = req.body;
      
      if (geminiApiKey) {
        process.env.GEMINI_API_KEY = geminiApiKey;
      } else if (firestore) {
        // Fallback for non-client calls (e.g. testing) that might rely on the DB
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

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({ error: "Gemini API Key is not configured. Please add it in the Admin Panel under API Integration or in your environment variables." });
        return;
      }

      const result = await generateEmail(restBody);
      res.status(200).json(result);
    } catch (error: any) {
      console.error("API Route Error:", error);
      
      const errorDetails = error.message || "";
      if (errorDetails.includes("429 Too Many Requests") || errorDetails.includes("Quota exceeded")) {
        res.status(429).json({ 
          error: "Rate Limit Exceeded", 
          details: "The free tier limit for the AI model has been reached. Please wait a minute before trying again, or configure your own Gemini API Key in the Admin Panel." 
        });
        return;
      }
      
      res.status(500).json({ error: "Failed to generate email", details: error.message, stack: error.stack });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
