import { google } from 'googleapis';
import { CalendarEvent, CalendarTask, CalendarCreateResponse } from '../types/calendar';

// Get the base URL for OAuth redirect
function getBaseUrl(): string {
    // Priority: NEXTAUTH_URL > VERCEL_URL > localhost
    if (process.env.NEXTAUTH_URL) {
        return process.env.NEXTAUTH_URL;
    }
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    return 'http://localhost:3000';
}

const REDIRECT_URI = `${getBaseUrl()}/api/auth/callback`;

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
);

export function getAuthUrl(state?: string): string {
    const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email',
    ];

    // Debug: Log the redirect URI being used
    console.log('OAuth Redirect URI:', REDIRECT_URI);
    console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
    console.log('VERCEL_URL:', process.env.VERCEL_URL);

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent',
        state: state,
    });
}

export async function getTokensFromCode(code: string) {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
}

export async function getUserEmail(accessToken: string): Promise<string> {
    oauth2Client.setCredentials({ access_token: accessToken });

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    return data.email || '';
}

export async function createCalendarEvent(
    accessToken: string,
    event: CalendarEvent,
    calendarId: string = 'primary'
): Promise<CalendarCreateResponse> {
    try {
        oauth2Client.setCredentials({ access_token: accessToken });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const eventResource = {
            summary: event.title,
            description: event.description,
            location: event.location,
            start: {
                dateTime: event.startDateTime,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
                dateTime: event.endDateTime,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            attendees: event.attendees?.map(email => ({ email })),
            reminders: event.reminders || {
                useDefault: true,
            },
            colorId: event.colorId,
        };

        const response = await calendar.events.insert({
            calendarId,
            requestBody: eventResource,
            sendUpdates: 'all',
        });

        return {
            success: true,
            eventId: response.data.id || undefined,
            eventLink: response.data.htmlLink || undefined,
        };
    } catch (error) {
        console.error('Error creating calendar event:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create event',
        };
    }
}

export async function createCalendarTask(
    accessToken: string,
    task: CalendarTask,
    calendarId: string = 'primary',
    attendees: string[] = []
): Promise<CalendarCreateResponse> {
    try {
        oauth2Client.setCredentials({ access_token: accessToken });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // Tasks are created as all-day events in Google Calendar
        // Include attendees so they receive invitations
        const taskResource: {
            summary: string;
            description: string;
            start: { date: string };
            end: { date: string };
            transparency: string;
            attendees?: { email: string }[];
        } = {
            summary: `📋 ${task.title}`,
            description: `${task.description || ''}\n\nPriority: ${task.priority || 'medium'}`,
            start: {
                date: task.dueDate.split('T')[0],
            },
            end: {
                date: task.dueDate.split('T')[0],
            },
            transparency: 'transparent', // Doesn't block time
        };

        // Add attendees if provided
        if (attendees.length > 0) {
            taskResource.attendees = attendees.map(email => ({ email }));
        }

        const response = await calendar.events.insert({
            calendarId,
            requestBody: taskResource,
            sendUpdates: attendees.length > 0 ? 'all' : 'none', // Send email notifications to attendees
        });

        return {
            success: true,
            eventId: response.data.id || undefined,
            eventLink: response.data.htmlLink || undefined,
        };
    } catch (error) {
        console.error('Error creating calendar task:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create task',
        };
    }
}

export async function listCalendars(accessToken: string) {
    try {
        oauth2Client.setCredentials({ access_token: accessToken });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const response = await calendar.calendarList.list();

        return response.data.items || [];
    } catch (error) {
        console.error('Error listing calendars:', error);
        return [];
    }
}

export interface CalendarEventItem {
    id: string;
    title: string;
    description?: string;
    start: string;
    end: string;
    isAllDay: boolean;
    attendees: string[];
    link?: string;
    created: string;
}

export async function listUpcomingEvents(
    accessToken: string,
    calendarId: string = 'primary',
    maxResults: number = 50
): Promise<{ success: boolean; events?: CalendarEventItem[]; error?: string }> {
    try {
        oauth2Client.setCredentials({ access_token: accessToken });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const now = new Date();
        const response = await calendar.events.list({
            calendarId,
            timeMin: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Past 7 days
            timeMax: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(), // Next 90 days
            maxResults,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events: CalendarEventItem[] = (response.data.items || []).map(event => ({
            id: event.id || '',
            title: event.summary || 'Untitled',
            description: event.description || undefined,
            start: event.start?.dateTime || event.start?.date || '',
            end: event.end?.dateTime || event.end?.date || '',
            isAllDay: !event.start?.dateTime,
            attendees: (event.attendees || []).map(a => a.email || '').filter(Boolean),
            link: event.htmlLink || undefined,
            created: event.created || '',
        }));

        return { success: true, events };
    } catch (error) {
        console.error('Error listing events:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list events',
        };
    }
}

export interface DeleteEventResponse {
    success: boolean;
    error?: string;
}

export async function deleteCalendarEvent(
    accessToken: string,
    eventId: string,
    calendarId: string = 'primary',
    sendCancellationNotifications: boolean = true
): Promise<DeleteEventResponse> {
    try {
        oauth2Client.setCredentials({ access_token: accessToken });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        await calendar.events.delete({
            calendarId,
            eventId,
            sendUpdates: sendCancellationNotifications ? 'all' : 'none', // 'all' sends cancellation emails to attendees
        });

        return { success: true };
    } catch (error) {
        console.error('Error deleting calendar event:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete event',
        };
    }
}

