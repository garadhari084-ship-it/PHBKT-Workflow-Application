import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { firestore } from "./backend/firebase-server";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoints
  app.post("/api/create-work-item", async (req, res) => {
    try {
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        res.status(500).json({ error: "Server missing GOOGLE_APPLICATION_CREDENTIALS. External API integration requires Firebase Admin credentials." });
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

      const { createWorkItemFromApi } = await import("./backend/ai/flows/create-work-item-flow");

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
      res.status(500).json({ error: "Failed to create work item", details: error.message });
    }
  });

  app.post("/api/generate-email", async (req, res) => {
    try {
      const { geminiApiKey, ...restBody } = req.body;
      
      if (geminiApiKey) {
        process.env.GEMINI_API_KEY = geminiApiKey;
      } else {
        // Fallback for non-client calls (e.g. testing) that might rely on the DB
        // But only if we have credentials set
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          const configRef = firestore.collection("app_config").doc("main");
          const configSnap = await configRef.get();
          const configData = configSnap.data();
          if (configData?.geminiApiKey) {
            process.env.GEMINI_API_KEY = configData.geminiApiKey;
          }
        }
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({ error: "Gemini API Key is not configured. Please add it in the Admin Panel under API Integration." });
        return;
      }

      const { generateEmail } = await import("./backend/ai/flows/generate-email-flow");

      const result = await generateEmail(restBody);
      res.status(200).json(result);
    } catch (error: any) {
      console.error("API Route Error:", error);
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
