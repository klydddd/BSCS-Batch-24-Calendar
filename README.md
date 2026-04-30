# Klase

AI-powered calendar automation for students. Parse to-do lists into Google Calendar events and send invites automatically.

## Features

- **AI Parsing** - Google Gemini converts natural language into structured events
- **Bulk Invites** - Add multiple recipients; invites sent automatically
- **Event Management** - View, edit, search, and delete calendar events
- **Class Schedule** - Create and export weekly class schedules as images
- **OCR Import** - Extract schedules from images using Tesseract.js
- **Interactive Tutorial** - Guided onboarding for new users
- **Silent Mode** - Disable notifications during bulk operations

## Getting Started

### Prerequisites

- Node.js 18+
- Google Cloud Project with Calendar API and Gmail API enabled
- Google Gemini API key

### Installation

```bash
git clone https://github.com/klydddd/BSCS-Batch-28-Calendar.git
cd BSCS-Batch-28-Calendar
npm install
```

### Environment Variables

Create `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_URL=http://localhost:3000
```

### Google Cloud Setup

1. Enable Google Calendar API and Gmail API
2. Create OAuth 2.0 credentials (Web application)
3. Add redirect URI: `http://localhost:3000/api/auth/callback`
4. Add test users in OAuth consent screen

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

### Create Tab

1. Sign in with Google
2. Add recipient emails (optional)
3. Paste to-do list with natural language dates
4. Click "Generate Events" to parse
5. Select items and add to calendar

### Manage Tab

- View events in list or calendar view
- Search by title or attendee
- Edit or delete events

### Schedule Tab

- Add classes manually or import from image
- Drag to select time ranges
- Export as customizable PNG

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 15 | React framework |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Google Gemini | AI parsing |
| Google Calendar API | Event management |
| Tesseract.js | OCR processing |

## Project Structure

```
app/
├── api/
│   ├── auth/         # OAuth
│   ├── calendar/     # Event CRUD
│   ├── email/        # Gmail notifications
│   ├── parse/        # AI parsing
│   └── sheets/       # Google Sheets import
├── components/
│   └── ProductTour.tsx  # Interactive tutorial
├── lib/
│   ├── gemini.ts
│   └── googleCalendar.ts
└── page.tsx
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| App not verified | Add email to OAuth test users |
| Token expired | Sign out and sign in again |
| Events missing | Check Calendar API is enabled |

## License

Open source for educational purposes.
