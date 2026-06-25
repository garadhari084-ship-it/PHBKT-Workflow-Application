import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI({apiKey: process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'fake-key-to-prevent-crash'})],
  model: 'googleai/gemini-2.5-flash',
});
