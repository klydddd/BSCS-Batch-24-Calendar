import { NextRequest, NextResponse } from 'next/server';
import { parseSpreadsheetId, readSheetEmails } from '../../lib/googleCalendar';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { accessToken, sheetUrl, range } = body;

        if (!accessToken) {
            return NextResponse.json(
                { success: false, error: 'Not authenticated' },
                { status: 401 }
            );
        }

        if (!sheetUrl) {
            return NextResponse.json(
                { success: false, error: 'Sheet URL is required' },
                { status: 400 }
            );
        }

        // Parse the spreadsheet ID from the URL
        const spreadsheetId = parseSpreadsheetId(sheetUrl);
        if (!spreadsheetId) {
            return NextResponse.json(
                { success: false, error: 'Invalid Google Sheets URL. Please paste the full URL from your browser.' },
                { status: 400 }
            );
        }

        // Default to column A if no range specified
        const columnRange = range?.trim() || 'A';

        const result = await readSheetEmails(accessToken, spreadsheetId, columnRange);

        if (result.success) {
            return NextResponse.json({
                success: true,
                emails: result.emails,
                totalRows: result.totalRows,
            });
        } else {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('Sheets API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to read spreadsheet' },
            { status: 500 }
        );
    }
}
