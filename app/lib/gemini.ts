import { GoogleGenerativeAI } from '@google/generative-ai';
import { CalendarItem, AIParseResponse } from '../types/calendar';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SYSTEM_PROMPT = `You are a calendar assistant that parses natural language input into structured calendar events or tasks.

The user may provide:
- A single event or task
- MULTIPLE events/tasks in a list format (with bullet points, dashes, numbers, or line breaks)
- A class/course name followed by multiple items

Analyze the user's input and extract ALL events and tasks mentioned.

For EVENTS (meetings, appointments, activities with specific time):
- type: "event"
- title: The name/title of the event (include the course/class name if provided as context)
- description: Any additional details (optional)
- startDateTime: Start date and time in ISO 8601 format (e.g., "2025-12-15T10:00:00")
- endDateTime: End date and time in ISO 8601 format (default to 1 hour after start if not specified)
- location: Where the event takes place (optional)
- attendees: Array of email addresses if mentioned (optional)

For TASKS (to-do items, reminders, deadlines, submissions):
- type: "task"
- title: The task name (include the course/class name if provided as context)
- description: Any additional details (optional)
- dueDate: Due date in ISO 8601 format (e.g., "2025-12-15")
- priority: "low", "medium", or "high" based on urgency indicators

IMPORTANT RULES:
1. Use the current date context provided to calculate relative dates like "tomorrow", "next week", etc.
2. If no specific time is mentioned for an event, default to 9:00 AM
3. If no duration is specified, default to 1 hour for events
4. Return ONLY valid JSON, no markdown, no explanation
5. ALWAYS return a JSON ARRAY, even for a single item
6. If a course/class name is mentioned at the top (like "PEF3", "MATH101", etc.), prepend it to each item's title
7. Parse ALL items in the list - do not skip any
8. "Submit" or "submission" items with deadlines should be tasks
9. "Performance", "presentation", "meeting" items with specific dates/times should be events
10. Items with "until" or "by" deadlines are tasks
11. Items with "on" specific dates are usually events

CURRENT DATE CONTEXT: {{CURRENT_DATE}}

Return your response as a valid JSON ARRAY of objects. Each object matches one of these structures:

[
  {
    "type": "event",
    "title": "Course Name - Event Title",
    "description": "string or null",
    "startDateTime": "ISO 8601 string",
    "endDateTime": "ISO 8601 string",
    "location": "string or null",
    "attendees": ["email@example.com"] or null
  },
  {
    "type": "task",
    "title": "Course Name - Task Title",
    "description": "string or null",
    "dueDate": "ISO 8601 date string",
    "priority": "low" | "medium" | "high"
  }
]

Example input:
"PEF3
- Final Requirement: Practice Assessment Every Week (submit video again dec 12)
- MyClass Course Evaluation (until Dec. 12)
- Practice (Dec. 12)
- Non-main Performers Performance (on Dec. 12)
- Main Performers Performance (on Dec. 12)"

Example output:
[
  {"type": "task", "title": "PEF3 - Final Requirement: Practice Assessment - Submit Video", "dueDate": "2025-12-12", "priority": "high"},
  {"type": "task", "title": "PEF3 - MyClass Course Evaluation", "dueDate": "2025-12-12", "priority": "medium"},
  {"type": "event", "title": "PEF3 - Practice", "startDateTime": "2025-12-12T09:00:00", "endDateTime": "2025-12-12T10:00:00"},
  {"type": "event", "title": "PEF3 - Non-main Performers Performance", "startDateTime": "2025-12-12T09:00:00", "endDateTime": "2025-12-12T10:00:00"},
  {"type": "event", "title": "PEF3 - Main Performers Performance", "startDateTime": "2025-12-12T09:00:00", "endDateTime": "2025-12-12T10:00:00"}
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
                    parts: [{ text: 'I understand. I will parse natural language input into structured calendar events or tasks and return only valid JSON arrays. I will extract ALL items from the input, including multiple items in lists, and prepend course/class names to titles when provided. Please provide the input to parse.' }],
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
