import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({ apiKey: process.env.GEMINI_API_KEY }),
  ],
  model: googleAI.model('gemini-2.5-flash'),
});

export { z };
