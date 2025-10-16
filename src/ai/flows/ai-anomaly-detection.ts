'use server';

/**
 * @fileOverview An AI-powered anomaly detection tool for identifying visual inconsistencies across different banner versions.
 *
 * - detectBannerAnomalies - A function that handles the anomaly detection process.
 * - DetectBannerAnomaliesInput - The input type for the detectBannerAnomalies function.
 * - DetectBannerAnomaliesOutput - The return type for the detectBannerAnomalies function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectBannerAnomaliesInputSchema = z.object({
  referenceBannerDataUri: z
    .string()
    .describe(
      "A reference banner image as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'. Can be empty." // eslint-disable-line prettier/prettier
    ),
  comparisonBannerDataUris: z
    .array(z.string())
    .describe(
      'An array of banner images to compare against the reference banner, as data URIs that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'. Can be empty.' // eslint-disable-line prettier/prettier
    ),
  customPrompt: z
    .string()
    .optional()
    .describe('A specific user prompt to guide the anomaly detection.'),
});
export type DetectBannerAnomaliesInput = z.infer<typeof DetectBannerAnomaliesInputSchema>;

const DetectBannerAnomaliesOutputSchema = z.object({
  anomalies: z
    .array(z.string())
    .describe('A list of descriptions of visual anomalies detected in the comparison banners.'),
});
export type DetectBannerAnomaliesOutput = z.infer<typeof DetectBannerAnomaliesOutputSchema>;

export async function detectBannerAnomalies(
  input: DetectBannerAnomaliesInput
): Promise<DetectBannerAnomaliesOutput> {
  return detectBannerAnomaliesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'detectBannerAnomaliesPrompt',
  input: {schema: DetectBannerAnomaliesInputSchema},
  output: {schema: DetectBannerAnomaliesOutputSchema},
  prompt: `You are an expert QA tester specializing in detecting visual anomalies in advertising banners.
{{#if customPrompt}}
Your task is to focus on the user's specific request: "{{customPrompt}}". Analyze the banners based on this request and provide a detailed answer.
{{else}}
Your task is to identify and describe any visual inconsistencies or anomalies present in the comparison banners compared to the reference banner.
{{/if}}

{{#if referenceBannerDataUri}}
Reference Banner: {{media url=referenceBannerDataUri}}
{{/if}}

{{#if comparisonBannerDataUris.length}}
Comparison Banners:
{{#each comparisonBannerDataUris}}- {{media url=this}}
{{/each}}
{{/if}}

{{#if (and (not referenceBannerDataUri) (eq comparisonBannerDataUris.length 0))}}
You have not been provided with any banner images. Please analyze the user's prompt: "{{customPrompt}}" and provide a helpful response based on the question.
{{else}}
Anomalies:
{{/if}}
`,
});

const detectBannerAnomaliesFlow = ai.defineFlow(
  {
    name: 'detectBannerAnomaliesFlow',
    inputSchema: DetectBannerAnomaliesInputSchema,
    outputSchema: DetectBannerAnomaliesOutputSchema,
  },
  async input => {
    // If no images and no prompt, guide the user.
    if (!input.referenceBannerDataUri && input.comparisonBannerDataUris.length === 0 && !input.customPrompt) {
      return {
        anomalies: ['Cannot perform analysis because no banner images were provided and no prompt was given. Please select banners to analyze or ask a question.'],
      };
    }
    
    const {output} = await prompt(input);
    return output!;
  }
);

    