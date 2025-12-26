import { HfInference } from '@huggingface/inference';

// Initialize the Hugging Face client
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

export interface ParsedScheduleEntry {
    subjectCode: string;
    day: string;
    startTime: string;
    endTime: string;
    room: string;
}

const SCHEDULE_PROMPT = `You are a schedule parser. Analyze this image of a class schedule table.

The table has columns like: SUBJECT CODE, SUBJECT NAME, SCHEDULE, SECTION & ROOM #, UNITS, FACULTY ASSIGNED.

Extract ONLY the following information for each class row:
1. subjectCode: The course code (e.g., "ALC01", "CCS05", "ETHICS", "OPS01")
2. schedule: Parse the SCHEDULE column which contains day codes and times.
3. room: The entire text from the "SECTION & ROOM #" column (e.g., "BSCS-1A / 501", "BSCS-1B / LAB1").

Day codes: M = Monday, T = Tuesday, W = Wednesday, TH = Thursday, F = Friday, S = Saturday

For entries with multiple schedules or combined days (e.g., "MTH"), create entries for EACH day.

Return a JSON array of objects with this structure:
[
  {
    "subjectCode": "ALC01",
    "day": "Monday",
    "startTime": "08:00",
    "endTime": "11:00",
    "room": "BSCS-1A / 501"
  }
]

IMPORTANT:
- Convert times to 24-hour format (e.g. 1:00PM -> 13:00)
- If "MTH" appears, create separate entries for Monday and Thursday with the SAME room info.
- Return ONLY the JSON array, no markdown, no explanation.
- Ignore header rows and total rows.
- If the Subject Code is not found, use the course name instead.`;

/**
 * Parse a schedule image using Hugging Face's vision-language model
 * @param imageBase64 - Base64 encoded image data
 * @param mimeType - Image MIME type (e.g., 'image/png', 'image/jpeg')
 * @returns Array of parsed schedule entries
 */
export async function parseScheduleImage(
    imageBase64: string,
    mimeType: string
): Promise<ParsedScheduleEntry[]> {
    if (!process.env.HUGGINGFACE_API_KEY) {
        throw new Error('HUGGINGFACE_API_KEY is not configured');
    }

    try {
        // Convert base64 to Blob for the API
        const imageBytes = Buffer.from(imageBase64, 'base64');
        const imageBlob = new Blob([imageBytes], { type: mimeType });

        // Use Qwen2-VL for vision-language understanding
        // This model is good at OCR and structured data extraction
        const response = await hf.chatCompletion({
            model: 'Qwen/Qwen2.5-VL-72B-Instruct',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: SCHEDULE_PROMPT,
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${imageBase64}`,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 2048,
        });

        // Extract the text response
        const textResponse = response.choices[0]?.message?.content || '';

        // Clean the response - remove markdown code blocks if present
        let cleanedText = textResponse.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.slice(7);
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.slice(3);
        }
        if (cleanedText.endsWith('```')) {
            cleanedText = cleanedText.slice(0, -3);
        }
        cleanedText = cleanedText.trim();

        console.log('Hugging Face response:', cleanedText);

        // Parse the JSON response
        const parsed: ParsedScheduleEntry[] = JSON.parse(cleanedText);

        return parsed;
    } catch (error) {
        console.error('Error parsing schedule with Hugging Face:', error);
        throw error;
    }
}

/**
 * Alternative: Use a simpler OCR approach with image-to-text
 * This can be used as a fallback if the vision-language model fails
 */
export async function extractTextFromImage(
    imageBase64: string,
    mimeType: string
): Promise<string> {
    if (!process.env.HUGGINGFACE_API_KEY) {
        throw new Error('HUGGINGFACE_API_KEY is not configured');
    }

    try {
        const imageBytes = Buffer.from(imageBase64, 'base64');
        const imageBlob = new Blob([imageBytes], { type: mimeType });

        // Use a dedicated OCR model
        const result = await hf.imageToText({
            model: 'microsoft/trocr-base-printed',
            data: imageBlob,
        });

        return result.generated_text || '';
    } catch (error) {
        console.error('Error extracting text from image:', error);
        throw error;
    }
}
