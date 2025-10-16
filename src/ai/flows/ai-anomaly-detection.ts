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
      'A reference banner image as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'. Can be empty.' // eslint-disable-line prettier/prettier
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
{{#if referenceBannerDataUri}}
You will be provided with a reference banner image and a list of comparison banner images. 
{{#if customPrompt}}
Your task is to focus on the user's specific request: "{{customPrompt}}". Analyze the banners based on this request and provide a detailed answer.
{{else}}
Your task is to identify and describe any visual inconsistencies or anomalies present in the comparison banners compared to the reference banner.
{{/if}}

Reference Banner: {{media url=referenceBannerDataUri}}

Comparison Banners:
{{#each comparisonBannerDataUris}}- {{media url=this}}
{{/each}}
{{else}}
The user has not provided banner images for analysis.
{{#if customPrompt}}
Please respond to the user's prompt directly: "{{customPrompt}}".
{{else}}
Please inform the user that to perform an anomaly detection, they need to provide banner images.
{{/if}}
{{/if}}

Anomalies:`, // eslint-disable-line prettier/prettier
});

const detectBannerAnomaliesFlow = ai.defineFlow(
  {
    name: 'detectBannerAnomaliesFlow',
    inputSchema: DetectBannerAnomaliesInputSchema,
    outputSchema: DetectBannerAnomaliesOutputSchema,
  },
  async input => {
    // If no image data is provided, but there's a custom prompt, let the model respond.
    if (!input.referenceBannerDataUri && input.customPrompt) {
        const {output} = await prompt(input);
        return output!;
    }
    // If no image data AND no prompt, guide the user.
    if (!input.referenceBannerDataUri) {
      return {
        anomalies: ['Cannot perform visual analysis because no banner images were provided. Please select banners to analyze.'],
      };
    }
    
    const {output} = await prompt(input);
    return output!;
  }
);
