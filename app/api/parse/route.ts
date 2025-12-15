import { NextRequest, NextResponse } from 'next/server';
import { parseInputWithAI } from '../../lib/gemini';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { input, timezone } = body;

        if (!input || typeof input !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Input is required and must be a string' },
                { status: 400 }
            );
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { success: false, error: 'Gemini API key not configured' },
                { status: 500 }
            );
        }

        const result = await parseInputWithAI(input, timezone);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error in parse API:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
