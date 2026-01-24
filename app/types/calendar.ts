// Types for calendar events and tasks

export interface CalendarEvent {
    type: 'event';
    title: string;
    description?: string;
    startDateTime: string; // ISO 8601 format (date-only for all-day events, e.g., "2025-12-15")
    endDateTime: string;   // ISO 8601 format (date-only for all-day events, e.g., "2025-12-15")
    location?: string;
    reminders?: {
        useDefault: boolean;
        overrides?: { method: 'email' | 'popup'; minutes: number }[];
    };
    attendees?: string[];
    colorId?: string;
    isAllDay?: boolean; // If true, startDateTime and endDateTime are dates only (no time)
}

export interface CalendarTask {
    type: 'task';
    title: string;
    description?: string;
    dueDate: string; // ISO 8601 format (date only for all-day)
    priority?: 'low' | 'medium' | 'high';
    status?: 'needsAction' | 'completed';
    colorId?: string; // Google Calendar color ID
}

export type CalendarItem = CalendarEvent | CalendarTask;

export interface AIParseResponse {
    success: boolean;
    data?: CalendarItem[];
    error?: string;
    rawInput?: string;
}

export interface CalendarCreateResponse {
    success: boolean;
    eventId?: string;
    eventLink?: string;
    error?: string;
}

export interface UserSession {
    email: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
}
