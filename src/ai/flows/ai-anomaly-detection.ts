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
      'A reference banner image as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' // eslint-disable-line prettier/prettier
    ),
  comparisonBannerDataUris: z
    .array(z.string())
    .describe(
      'An array of banner images to compare against the reference banner, as data URIs that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' // eslint-disable-line prettier/prettier
    ),
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
  prompt: `You are an expert QA tester specializing in detecting visual anomalies in advertising banners.\n\nYou will be provided with a reference banner image and a list of comparison banner images. Your task is to identify and describe any visual inconsistencies or anomalies present in the comparison banners compared to the reference banner.\n\nReference Banner: {{media url=referenceBannerDataUri}}\n\nComparison Banners:\n{{#each comparisonBannerDataUris}}- {{media url=this}}\n{{/each}}\n\nAnomalies:`, // eslint-disable-line prettier/prettier
});

const detectBannerAnomaliesFlow = ai.defineFlow(
  {
    name: 'detectBannerAnomaliesFlow',
    inputSchema: DetectBannerAnomaliesInputSchema,
    outputSchema: DetectBannerAnomaliesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
