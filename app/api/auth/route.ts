import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '../../lib/googleCalendar';

export async function GET(request: NextRequest) {
    try {
        const authUrl = getAuthUrl();

        return NextResponse.json({ authUrl });
    } catch (error) {
        console.error('Error generating auth URL:', error);
        return NextResponse.json(
            { error: 'Failed to generate auth URL' },
            { status: 500 }
        );
    }
}
