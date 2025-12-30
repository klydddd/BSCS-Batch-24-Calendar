import { HfInference } from '@huggingface/inference';

// Initialize the Hugging Face client
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

export interface ParsedScheduleEntry {
    subjectCode: string;
    subjectName?: string;  // Subject title/name (e.g., "Software Engineering")
    day: string;
    startTime: string;
    endTime: string;
    room: string;
}

const SCHEDULE_PROMPT = `You are a schedule parser. Analyze this image of a class schedule table.

The table typically has columns like: SUBJECT CODE, SUBJECT TITLE/NAME, SCHEDULE, SECTION & ROOM #, UNITS, FACULTY ASSIGNED.

Extract ONLY the following information for each class row:
1. subjectCode: The course code (e.g., "CMSC 128", "PSYCH-EC 02", "ALC01", "CCS05")
2. subjectName: The subject title/name (e.g., "Software Engineering", "Clinical Psychology", "Data Structures")
3. schedule: Parse the SCHEDULE column which contains day codes and times.
4. room: The entire text from the "SECTION & ROOM #" or "ROOM" column (e.g., "BSCS-1A / 501", "TBA")

Day codes: M = Monday, T = Tuesday, W = Wednesday, TH = Thursday, F = Friday, S = Saturday, SU = Sunday

For entries with multiple schedules or combined days (e.g., "MTH", "TTh", "MW"), create entries for EACH day.

Return a JSON array of objects with this structure:
[
  {
    "subjectCode": "PSYCH-EC 02",
    "subjectName": "Clinical Psychology",
    "day": "Wednesday",
    "startTime": "09:00",
    "endTime": "12:00",
    "room": "TBA"
  }
]

IMPORTANT:
- Convert times to 24-hour format (e.g. 1:00PM -> 13:00, 9:00AM -> 09:00)
- If "MTH" or "MW" appears, create separate entries for each day with the SAME subject info.
- Return ONLY the JSON array, no markdown, no explanation.
- Ignore header rows and total rows.
- ALWAYS extract both subjectCode and subjectName if they are in separate columns.
- If only one column exists for subject, use it for subjectCode and leave subjectName empty.`;

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
            model: 'Qwen/Qwen3-VL-235B-A22B-Instruct',
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
