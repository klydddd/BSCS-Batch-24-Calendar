import { GoogleGenerativeAI } from '@google/generative-ai';
import { CalendarItem, AIParseResponse } from '../types/calendar';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SYSTEM_PROMPT = `You are a calendar assistant that parses natural language input into structured calendar EVENTS.

The user may provide:
- A single event
- MULTIPLE events in a list format (with bullet points, dashes, numbers, or line breaks)
- A class/course name followed by multiple scheduled items

Analyze the user's input and extract ALL items as EVENTS.

For ALL items, create EVENTS with:
- type: "event" (ALWAYS use "event", never "task")
- title: The event name (include the course/class name if provided as context)
- description: Any additional details (optional)
- startDateTime: Start date/time in ISO 8601 format (e.g. "2025-12-15T09:00:00" or "2025-12-15" for all-day)
- endDateTime: End date/time in ISO 8601 format (e.g. "2025-12-15T10:00:00" or "2025-12-15" for all-day)
- isAllDay: boolean (true if no specific time is mentioned)

IMPORTANT RULES:
1. Use the current date context provided to calculate relative dates like "tomorrow", "next week", etc.
2. ALL items should be created as EVENTS.
3. If no time is mentioned, set isAllDay=true, and use "YYYY-MM-DD" for both start/end.
4. If time is mentioned, set isAllDay=false. If no end time is specified, assume 1 hour duration.
5. Return ONLY valid JSON, no markdown, no explanation
6. ALWAYS return a JSON ARRAY, even for a single item
7. If a course/class name is mentioned at the top (like "PEF3", "MATH101", etc.), prepend it to each item's title
8. Parse ALL items in the list - do not skip any

CURRENT DATE CONTEXT: {{CURRENT_DATE}}

Return your response as a valid JSON ARRAY of objects. Each object MUST have this structure:

[
  {
    "type": "event",
    "title": "Course Name - Event Title",
    "description": "string or null",
    "startDateTime": "ISO string",
    "endDateTime": "ISO string",
    "isAllDay": boolean
  }
]

Example input:
"PEF3
- Final Requirement: Practice Assessment (Dec 12)
- MyClass Course Evaluation (Dec 12)
- Practice (Dec 12, 1pm)"

Example output:
[
  {"type": "event", "title": "PEF3 - Final Requirement: Practice Assessment", "startDateTime": "2025-12-12", "endDateTime": "2025-12-12", "isAllDay": true},
  {"type": "event", "title": "PEF3 - MyClass Course Evaluation", "startDateTime": "2025-12-12", "endDateTime": "2025-12-12", "isAllDay": true},
  {"type": "event", "title": "PEF3 - Practice", "startDateTime": "2025-12-12T13:00:00", "endDateTime": "2025-12-12T14:00:00", "isAllDay": false}
]`;

export async function parseInputWithAI(input: string, timezone?: string): Promise<AIParseResponse> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // Use client timezone or default to Asia/Hong_Kong (UTC+8)
        const tz = timezone || 'Asia/Hong_Kong';
        const now = new Date();
        // Format date in the client's timezone for accurate "tomorrow" calculations
        const currentDateFormatted = now.toLocaleString('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        const prompt = SYSTEM_PROMPT.replace('{{CURRENT_DATE}}', `${currentDateFormatted} (Timezone: ${tz})`);

        const chat = model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{ text: prompt }],
                },
                {
                    role: 'model',
                    parts: [{ text: 'I understand. I will parse natural language input into structured calendar EVENTS only (never tasks) and return only valid JSON arrays. I will extract ALL items from the input as events, calculating start and end times or all-day status, and prepend course/class names to titles when provided. Please provide the input to parse.' }],
                },
            ],
        });

        const result = await chat.sendMessage(input);
        const response = await result.response;
        const text = response.text();

        // Clean the response - remove markdown code blocks if present
        let cleanedText = text.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.slice(7);
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.slice(3);
        }
        if (cleanedText.endsWith('```')) {
            cleanedText = cleanedText.slice(0, -3);
        }
        cleanedText = cleanedText.trim();

        const parsed = JSON.parse(cleanedText);

        // Ensure we always have an array
        const items: CalendarItem[] = Array.isArray(parsed) ? parsed : [parsed];

        return {
            success: true,
            data: items,
            rawInput: input,
        };
    } catch (error) {
        console.error('Error parsing input with Gemini:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to parse input',
            rawInput: input,
        };
    }
}
