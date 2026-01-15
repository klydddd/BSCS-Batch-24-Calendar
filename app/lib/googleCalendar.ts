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
        'https://www.googleapis.com/auth/gmail.send', // For sending summary emails
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
    calendarId: string = 'primary',
    timezone: string = 'Asia/Hong_Kong',
    sendNotifications: boolean = true
): Promise<CalendarCreateResponse> {
    try {
        oauth2Client.setCredentials({ access_token: accessToken });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // Use explicit timezone from client, not server's timezone
        const eventResource = {
            summary: event.title,
            description: event.description,
            location: event.location,
            start: {
                dateTime: event.startDateTime,
                timeZone: timezone,
            },
            end: {
                dateTime: event.endDateTime,
                timeZone: timezone,
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
            sendUpdates: sendNotifications ? 'all' : 'none',
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
    attendees: string[] = [],
    sendNotifications: boolean = true
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
            sendUpdates: sendNotifications && attendees.length > 0 ? 'all' : 'none',
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

export interface UpdateEventData {
    title?: string;
    description?: string;
    startDateTime?: string;
    endDateTime?: string;
    startDate?: string; // For all-day events
    endDate?: string;   // For all-day events
    isAllDay?: boolean;
}

export interface UpdateEventResponse {
    success: boolean;
    error?: string;
}

export async function updateCalendarEvent(
    accessToken: string,
    eventId: string,
    updateData: UpdateEventData,
    calendarId: string = 'primary',
    timezone: string = 'Asia/Hong_Kong',
    sendNotifications: boolean = true
): Promise<UpdateEventResponse> {
    try {
        oauth2Client.setCredentials({ access_token: accessToken });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // First, get the existing event
        const existingEvent = await calendar.events.get({
            calendarId,
            eventId,
        });

        // Build the update payload
        const eventResource: Record<string, unknown> = {
            ...existingEvent.data,
        };

        if (updateData.title !== undefined) {
            eventResource.summary = updateData.title;
        }

        if (updateData.description !== undefined) {
            eventResource.description = updateData.description;
        }

        // Handle date/time updates
        if (updateData.isAllDay) {
            // Convert to all-day event
            if (updateData.startDate) {
                eventResource.start = { date: updateData.startDate };
            }
            if (updateData.endDate) {
                eventResource.end = { date: updateData.endDate };
            }
        } else {
            // Timed event
            if (updateData.startDateTime) {
                eventResource.start = {
                    dateTime: updateData.startDateTime,
                    timeZone: timezone,
                };
            }
            if (updateData.endDateTime) {
                eventResource.end = {
                    dateTime: updateData.endDateTime,
                    timeZone: timezone,
                };
            }
        }

        await calendar.events.update({
            calendarId,
            eventId,
            requestBody: eventResource,
            sendUpdates: sendNotifications ? 'all' : 'none',
        });

        return { success: true };
    } catch (error) {
        console.error('Error updating calendar event:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update event',
        };
    }
}

export interface CreatedEventInfo {
    title: string;
    date: string;
    time?: string;
    link?: string;
    isAllDay: boolean;
}

export interface SendEmailResponse {
    success: boolean;
    error?: string;
}

export async function sendSummaryEmail(
    accessToken: string,
    senderEmail: string,
    recipients: string[],
    events: CreatedEventInfo[],
    customSubject?: string
): Promise<SendEmailResponse> {
    try {
        console.log('sendSummaryEmail called:', { senderEmail, recipientCount: recipients.length, eventCount: events.length });

        if (recipients.length === 0 || events.length === 0) {
            console.log('sendSummaryEmail: Nothing to send (no recipients or events)');
            return { success: true }; // Nothing to send
        }

        oauth2Client.setCredentials({ access_token: accessToken });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Format events for email
        const eventsList = events
            .map((event, index) => {
                const dateDisplay = event.isAllDay
                    ? new Date(event.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })
                    : `${new Date(event.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })}${event.time ? ` at ${event.time}` : ''}`;

                const linkHtml = event.link
                    ? ` <a href="${event.link}" style="color: #3b82f6;">[View in Calendar]</a>`
                    : '';

                return `<tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                        <strong style="color: #1f2937;">${index + 1}. ${event.title}</strong>
                        <br/>
                        <span style="color: #6b7280; font-size: 14px;">📅 ${dateDisplay}${linkHtml}</span>
                    </td>
                </tr>`;
            })
            .join('');

        const subject = customSubject || `📋 ${events.length} New Calendar Item${events.length > 1 ? 's' : ''} Added`;

        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📅 Calendar Update</h1>
            <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 14px;">
                ${events.length} item${events.length > 1 ? 's have' : ' has'} been added to your calendar
            </p>
        </div>
        
        <div style="padding: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
                ${eventsList}
            </table>
            
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
                    This email was sent via BSCS Calendar Automation
                </p>
            </div>
        </div>
    </div>
</body>
</html>`;

        const textBody = `Calendar Update\n\n${events.length} item${events.length > 1 ? 's have' : ' has'} been added to your calendar:\n\n${events
            .map(
                (event, index) =>
                    `${index + 1}. ${event.title}\n   Date: ${event.date}${event.time ? ` at ${event.time}` : ''}\n   ${event.link ? `Link: ${event.link}` : ''}`
            )
            .join('\n\n')}`;

        // Create the email message
        const messageParts = [
            `From: ${senderEmail}`,
            `To: ${recipients.join(', ')}`,
            `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="boundary_alt"',
            '',
            '--boundary_alt',
            'Content-Type: text/plain; charset="UTF-8"',
            '',
            textBody,
            '',
            '--boundary_alt',
            'Content-Type: text/html; charset="UTF-8"',
            '',
            htmlBody,
            '',
            '--boundary_alt--',
        ];

        const message = messageParts.join('\r\n');
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        console.log('Sending email via Gmail API...');

        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });

        console.log('Email sent successfully!');
        return { success: true };
    } catch (error: unknown) {
        console.error('Error sending summary email:', error);

        // Check for specific Gmail API errors
        let errorMessage = 'Failed to send email';
        if (error && typeof error === 'object' && 'code' in error) {
            const apiError = error as { code: number; message?: string };
            if (apiError.code === 403) {
                errorMessage = 'Gmail permission denied. Please log out and log back in to grant email permissions.';
            } else if (apiError.code === 401) {
                errorMessage = 'Authentication expired. Please log out and log back in.';
            } else {
                errorMessage = apiError.message || errorMessage;
            }
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }

        return {
            success: false,
            error: errorMessage,
        };
    }
}

export interface CancelledEventInfo {
    title: string;
    date: string;
    isAllDay: boolean;
}

export async function sendCancellationEmail(
    accessToken: string,
    senderEmail: string,
    recipients: string[],
    events: CancelledEventInfo[],
    customSubject?: string
): Promise<SendEmailResponse> {
    try {
        if (recipients.length === 0 || events.length === 0) {
            return { success: true }; // Nothing to send
        }

        oauth2Client.setCredentials({ access_token: accessToken });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Format events for email
        const eventsList = events
            .map((event, index) => {
                const dateDisplay = event.isAllDay
                    ? new Date(event.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })
                    : new Date(event.date).toLocaleString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    });

                return `<tr>
                    <td style="padding: 12px; border-bottom: 1px solid #fecaca;">
                        <strong style="color: #991b1b; text-decoration: line-through;">${index + 1}. ${event.title}</strong>
                        <br/>
                        <span style="color: #dc2626; font-size: 14px;">❌ ${dateDisplay}</span>
                    </td>
                </tr>`;
            })
            .join('');

        const subject = customSubject || `🚫 ${events.length} Calendar Item${events.length > 1 ? 's' : ''} Cancelled`;

        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 20px; background-color: #fef2f2;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🚫 Calendar Cancellation</h1>
            <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 14px;">
                ${events.length} item${events.length > 1 ? 's have' : ' has'} been cancelled
            </p>
        </div>
        
        <div style="padding: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
                ${eventsList}
            </table>
            
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #fecaca;">
                <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
                    This email was sent via BSCS Calendar Automation
                </p>
            </div>
        </div>
    </div>
</body>
</html>`;

        const textBody = `Calendar Cancellation\n\n${events.length} item${events.length > 1 ? 's have' : ' has'} been cancelled:\n\n${events
            .map(
                (event, index) =>
                    `${index + 1}. ${event.title} (CANCELLED)\n   Was scheduled for: ${event.date}`
            )
            .join('\n\n')}`;

        // Create the email message
        const messageParts = [
            `From: ${senderEmail}`,
            `To: ${recipients.join(', ')}`,
            `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="boundary_alt"',
            '',
            '--boundary_alt',
            'Content-Type: text/plain; charset="UTF-8"',
            '',
            textBody,
            '',
            '--boundary_alt',
            'Content-Type: text/html; charset="UTF-8"',
            '',
            htmlBody,
            '',
            '--boundary_alt--',
        ];

        const message = messageParts.join('\r\n');
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });

        return { success: true };
    } catch (error) {
        console.error('Error sending cancellation email:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send cancellation email',
        };
    }
}
