import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ParsedScheduleEntry {
    subjectCode: string;
    day: string;
    startTime: string;
    endTime: string;
    room: string;
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SCHEDULE_PROMPT = `You are a schedule parser. Analyze this image of a class schedule table.

The table has columns like: SUBJECT CODE, SUBJECT NAME, SCHEDULE, SECTION & ROOM #, UNITS, FACULTY ASSIGNED.

Extract ONLY the following information for each class row:
1. subjectCode: The course code (e.g., "ALC01", "CCS05", "ETHICS", "OPS01")
2. schedule: Parse the SCHEDULE column which contains day codes and times.
3. room: The entire text from the "SECTION & ROOM #" column (e.g., "BSCS-1A / 501", "BSCS-1B / LAB1").

Day codes: M, T, W, TH, F, S

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
- Return ONLY the JSON array.
- Ignore header rows and total rows.`;

export async function POST(request: NextRequest) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { success: false, error: 'Gemini API key not configured' },
                { status: 500 }
            );
        }

        const formData = await request.formData();
        const file = formData.get('image') as File;

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'No image provided' },
                { status: 400 }
            );
        }

        // Convert file to base64
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Image = buffer.toString('base64');
        const mimeType = file.type || 'image/png';

        // Use Gemini Vision model
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const result = await model.generateContent([
            SCHEDULE_PROMPT,
            {
                inlineData: {
                    data: base64Image,
                    mimeType: mimeType,
                },
            },
        ]);

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

        console.log('Gemini response:', cleanedText);

        const parsed: ParsedScheduleEntry[] = JSON.parse(cleanedText);

        return NextResponse.json({
            success: true,
            data: parsed,
        });
    } catch (error) {
        console.error('Error parsing schedule with Gemini:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to parse schedule' },
            { status: 500 }
        );
    }
}
