'use server';
/**
 * @fileOverview Generates email content for customer communication.
 *
 * - generateEmail - A function that creates email subjects and bodies.
 * - GenerateEmailInput - The input type for the generateEmail function.
 * - GenerateEmailOutput - The return type for the generateEmail function.
 */

import {ai} from '../genkit';
import {z} from 'genkit';

const GenerateEmailInputSchema = z.object({
  customerName: z.string().describe('The name of the customer receiving the email.'),
  agentName: z.string().describe('The name of the agent sending the email.'),
  workType: z.string().describe('The type of work being done (e.g., "New Business Request").'),
  task: z.string().describe('The specific task related to the work item.'),
  emailPurpose: z.string().describe('The purpose of the email (e.g., "Status Update", "Request for Information").'),
  companyName: z.string().describe('The name of the company sending the email.'),
});
export type GenerateEmailInput = z.infer<typeof GenerateEmailInputSchema>;

const GenerateEmailOutputSchema = z.object({
  subject: z.string().describe('A concise and relevant subject line for the email.'),
  body: z.string().describe('The full body content of the email, written in a professional and friendly tone.'),
});
export type GenerateEmailOutput = z.infer<typeof GenerateEmailOutputSchema>;

const prompt = ai.definePrompt({
  name: 'generateEmailPrompt',
  input: {schema: GenerateEmailInputSchema},
  output: {schema: GenerateEmailOutputSchema},
  prompt: `You are an expert business development executive at {{companyName}}, a leading provider of digital solutions.
Your goal is to write a professional, welcoming, and informative initial outreach email to a potential new client.
Avoid internal jargon like "lead generated." Focus on building a relationship and understanding the customer's needs.

**Email Context:**
- **To:** {{customerName}}
- **From:** {{agentName}}
- **Regarding Process:** {{workType}}
- **Specific Task/Interest:** {{task}}
- **Purpose of this Email:** {{emailPurpose}}

**Instructions:**
1.  **Subject:** Create a clear, engaging subject line. Examples: "Connecting about {{workType}}" or "Following up on your inquiry about {{task}}".
2.  **Body:** Write the email body with a professional and customer-centric tone. Structure it with clear paragraphs. Use newline characters \`\\n\` to separate paragraphs and lines for proper formatting.
    - **Salutation:** Start with a polite and personalized salutation (e.g., "Dear {{customerName}},"). Follow it with two newlines (\`\\n\\n\`).
    - **Opening:** Begin by acknowledging the connection. If the purpose is 'New Lead Generate For Conversation', you could say "Thank you for connecting with us." or "Following up on your recent interest in our services."
    - **Introduction & Value:** Briefly introduce {{companyName}} and its value. For example: "At {{companyName}}, we specialize in helping businesses grow their digital presence through comprehensive solutions like {{workType}}."
    - **Understanding Needs (Call to Action):** Clearly state the next step. Instead of just stating the 'purpose', frame it as a question to the customer. For example: "To help us understand how we can best assist you with '{{task}}', could you please share a few more details about your project goals or requirements? We would also be happy to schedule a brief consultation call at your convenience."
    - **Closing:** End with a professional closing. For example: "Best regards,\\n{{agentName}}".
3.  **Tone:** Maintain a helpful, professional, and proactive tone throughout the email.
`,
});

const generateEmailFlow = ai.defineFlow(
  {
    name: 'generateEmailFlow',
    inputSchema: GenerateEmailInputSchema,
    outputSchema: GenerateEmailOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
        throw new Error('Failed to generate email content.');
    }
    return output;
  }
);


export async function generateEmail(input: GenerateEmailInput): Promise<GenerateEmailOutput> {
    return await generateEmailFlow(input);
}
