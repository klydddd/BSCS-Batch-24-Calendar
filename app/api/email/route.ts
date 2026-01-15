import { NextRequest, NextResponse } from 'next/server';
import { sendSummaryEmail, sendCancellationEmail, CreatedEventInfo, CancelledEventInfo } from '../../lib/googleCalendar';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { accessToken, senderEmail, recipients, events, customSubject, emailType = 'summary' } = body;

        console.log('Email API called:', {
            emailType,
            senderEmail,
            recipientCount: recipients?.length,
            eventCount: events?.length,
            hasAccessToken: !!accessToken
        });

        if (!accessToken) {
            console.error('Email API: Missing access token');
            return NextResponse.json(
                { success: false, error: 'Access token is required' },
                { status: 401 }
            );
        }

        if (!senderEmail) {
            console.error('Email API: Missing sender email');
            return NextResponse.json(
                { success: false, error: 'Sender email is required' },
                { status: 400 }
            );
        }

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            console.error('Email API: No recipients provided');
            return NextResponse.json(
                { success: false, error: 'At least one recipient is required' },
                { status: 400 }
            );
        }

        if (!events || !Array.isArray(events) || events.length === 0) {
            console.error('Email API: No events provided');
            return NextResponse.json(
                { success: false, error: 'At least one event is required' },
                { status: 400 }
            );
        }

        console.log('Email API: Sending email...', { emailType, recipients, events });

        let result;

        if (emailType === 'cancellation') {
            result = await sendCancellationEmail(
                accessToken,
                senderEmail,
                recipients,
                events as CancelledEventInfo[],
                customSubject
            );
        } else {
            result = await sendSummaryEmail(
                accessToken,
                senderEmail,
                recipients,
                events as CreatedEventInfo[],
                customSubject
            );
        }

        console.log('Email API result:', result);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error in email API:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
