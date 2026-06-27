import express from "express";
import { createWorkItemFromApi } from "../backend/ai/flows/create-work-item-flow";
import { generateEmail } from "../backend/ai/flows/generate-email-flow";
import { firestore } from "../backend/firebase-server";

const app = express();

app.use(express.json());

app.post("/api/create-work-item", async (req, res) => {
  try {
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
    const result = await generateEmail(req.body);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("API Route Error:", error);
    res.status(500).json({ error: "Failed to generate email", details: error.message, stack: error.stack });
  }
});

export default app;
