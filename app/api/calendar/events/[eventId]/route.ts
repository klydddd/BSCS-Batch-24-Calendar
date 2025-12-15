import { NextRequest, NextResponse } from 'next/server';
import { deleteCalendarEvent, updateCalendarEvent } from '../../../../lib/googleCalendar';

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

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const body = await request.json();
        const { accessToken, updateData, timezone, sendNotifications } = body;

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

        if (!updateData) {
            return NextResponse.json(
                { success: false, error: 'Update data is required' },
                { status: 400 }
            );
        }

        const result = await updateCalendarEvent(
            accessToken,
            eventId,
            updateData,
            'primary',
            timezone || 'Asia/Hong_Kong',
            sendNotifications !== false
        );

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error in update event API:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
