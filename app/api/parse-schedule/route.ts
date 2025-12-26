import { NextRequest, NextResponse } from 'next/server';
import { parseScheduleImage, ParsedScheduleEntry } from '../../lib/huggingface';

export async function POST(request: NextRequest) {
    try {
        if (!process.env.HUGGINGFACE_API_KEY) {
            return NextResponse.json(
                { success: false, error: 'Hugging Face API key not configured' },
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

        // Use the centralized Hugging Face parsing function
        const parsed: ParsedScheduleEntry[] = await parseScheduleImage(base64Image, mimeType);

        return NextResponse.json({
            success: true,
            data: parsed,
        });
    } catch (error) {
        console.error('Error parsing schedule:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to parse schedule'
            },
            { status: 500 }
        );
    }
}
