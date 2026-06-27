import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

console.log("Before genkit initialization");
const ai = genkit({
  plugins: [googleAI()],
});
console.log("After genkit initialization");
