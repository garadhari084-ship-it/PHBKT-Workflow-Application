import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";

try {
  const ai = genkit({
    plugins: [googleAI()],
  });
  console.log("Success without key");
} catch(e) {
  console.log("Failed without key:", e.message);
}
