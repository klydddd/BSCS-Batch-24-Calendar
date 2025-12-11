import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode, getUserEmail } from '../../../lib/googleCalendar';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
            return NextResponse.redirect(
                new URL(`/?error=${encodeURIComponent(error)}`, request.url)
            );
        }

        if (!code) {
            return NextResponse.redirect(
                new URL('/?error=No authorization code received', request.url)
            );
        }

        const tokens = await getTokensFromCode(code);

        if (!tokens.access_token) {
            return NextResponse.redirect(
                new URL('/?error=Failed to get access token', request.url)
            );
        }

        const email = await getUserEmail(tokens.access_token);

        // Create a response that redirects to home with tokens in URL params
        // In production, you should use secure cookies or a session
        const redirectUrl = new URL('/', request.url);
        redirectUrl.searchParams.set('access_token', tokens.access_token);
        if (tokens.refresh_token) {
            redirectUrl.searchParams.set('refresh_token', tokens.refresh_token);
        }
        redirectUrl.searchParams.set('email', email);
        redirectUrl.searchParams.set('expires_at', String(tokens.expiry_date || Date.now() + 3600000));

        return NextResponse.redirect(redirectUrl);
    } catch (error) {
        console.error('Error in OAuth callback:', error);
        return NextResponse.redirect(
            new URL(`/?error=${encodeURIComponent('Authentication failed')}`, request.url)
        );
    }
}
