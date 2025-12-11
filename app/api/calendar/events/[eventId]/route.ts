import { NextRequest, NextResponse } from 'next/server';
import { deleteCalendarEvent } from '../../../../lib/googleCalendar';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const searchParams = request.nextUrl.searchParams;
        const accessToken = searchParams.get('access_token');
        const sendNotifications = searchParams.get('send_notifications') !== 'false';

        if (!accessToken) {
            return NextResponse.json(
                { success: false, error: 'Access token is required' },
                { status: 401 }
            );
        }

        if (!eventId) {
            return NextResponse.json(
                { success: false, error: 'Event ID is required' },
                { status: 400 }
            );
        }

        const result = await deleteCalendarEvent(
            accessToken,
            eventId,
            'primary',
            sendNotifications
        );

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error in delete event API:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
