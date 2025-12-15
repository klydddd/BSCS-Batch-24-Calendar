import { NextRequest, NextResponse } from 'next/server';
import { createCalendarEvent, createCalendarTask } from '../../lib/googleCalendar';
import { CalendarEvent, CalendarTask } from '../../types/calendar';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { accessToken, calendarItem, calendarId, attendees, timezone } = body;

        if (!accessToken) {
            return NextResponse.json(
                { success: false, error: 'Access token is required' },
                { status: 401 }
            );
        }

        if (!calendarItem) {
            return NextResponse.json(
                { success: false, error: 'Calendar item is required' },
                { status: 400 }
            );
        }

        let result;

        // Use provided timezone or default to Asia/Manila
        const tz = timezone || 'Asia/Manila';

        if (calendarItem.type === 'event') {
            // Merge attendees from the request with any existing attendees
            const eventWithAttendees: CalendarEvent = {
                ...calendarItem,
                attendees: [...(calendarItem.attendees || []), ...(attendees || [])],
            };
            result = await createCalendarEvent(
                accessToken,
                eventWithAttendees,
                calendarId || 'primary',
                tz
            );
        } else if (calendarItem.type === 'task') {
            // Pass attendees to task creation (will be used to send invites)
            result = await createCalendarTask(
                accessToken,
                calendarItem as CalendarTask,
                calendarId || 'primary',
                attendees || []
            );
        } else {
            return NextResponse.json(
                { success: false, error: 'Invalid calendar item type' },
                { status: 400 }
            );
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error in calendar API:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

