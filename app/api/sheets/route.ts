import { NextRequest, NextResponse } from 'next/server';
import { parseSpreadsheetId, readSheetEmails, listUserSpreadsheets } from '../../lib/googleCalendar';

// GET - List user's spreadsheets
export async function GET(request: NextRequest) {
    try {
        const accessToken = request.nextUrl.searchParams.get('access_token');

        if (!accessToken) {
            return NextResponse.json(
                { success: false, error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const result = await listUserSpreadsheets(accessToken);

        if (result.success) {
            return NextResponse.json({
                success: true,
                spreadsheets: result.spreadsheets,
            });
        } else {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('Sheets list API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to list spreadsheets' },
            { status: 500 }
        );
    }
}

// POST - Read emails from a specific spreadsheet
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { accessToken, sheetUrl, spreadsheetId: directId, range } = body;

        if (!accessToken) {
            return NextResponse.json(
                { success: false, error: 'Not authenticated' },
                { status: 401 }
            );
        }

        // Accept either a direct spreadsheetId (from picker) or parse from URL
        let spreadsheetId = directId;
        if (!spreadsheetId && sheetUrl) {
            spreadsheetId = parseSpreadsheetId(sheetUrl);
        }

        if (!spreadsheetId) {
            return NextResponse.json(
                { success: false, error: 'Please select a spreadsheet or paste a valid URL.' },
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
