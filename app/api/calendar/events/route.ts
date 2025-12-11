import { NextRequest, NextResponse } from 'next/server';
import { listUpcomingEvents } from '../../../lib/googleCalendar';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const accessToken = searchParams.get('access_token');

        if (!accessToken) {
            return NextResponse.json(
                { success: false, error: 'Access token is required' },
                { status: 401 }
            );
        }

        const result = await listUpcomingEvents(accessToken);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error in events list API:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
