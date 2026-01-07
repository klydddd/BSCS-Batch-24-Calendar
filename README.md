# BSCS Calendar Automation

AI-powered calendar automation tool for BSCS Batch 2025. Transform to-do lists and class schedules into Google Calendar events and send invites to your class automatically.

---

## Features

- **AI Parsing**: Uses Google Gemini to parse natural language into structured events
- **Multi-Recipient Invites**: Add multiple emails at once; recipients receive calendar invites automatically
- **Event Management**: View, search, and delete events with cancellation notifications
- **Modern UI**: Dark mode, glassmorphism design, fully responsive

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Cloud Project with Calendar API enabled and OAuth 2.0 credentials
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/klydddd/BSCS-25-26-Calendar.git
   cd BSCS-25-26-Calendar
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create `.env.local` in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   NEXTAUTH_URL=http://localhost:3000
   ```

4. **Configure Google Cloud Console**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create/select a project and enable **Google Calendar API**
   - Create OAuth 2.0 credentials (Web application)
   - Add redirect URI: `http://localhost:3000/api/auth/callback`
   - Add your email as a test user in OAuth consent screen

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

---

## Usage

### Creating Events

1. **Connect Google account** - Click "Connect Google" and authorize
2. **Add recipients** (optional) - Paste classmates' emails (comma, space, or newline separated)
3. **Paste your to-do list** - Use natural language, e.g.:
   ```
   PEF3
   - Final Requirement: Practice Assessment (submit video by Dec 12)
   - MyClass Course Evaluation (until Dec. 12)
   ```
4. **Parse** - Click the lightning button to parse input
5. **Review and create** - Select items and click "Add Selected & Send Invites"

### Managing Events

1. Switch to **"Manage Events"** tab
2. View events from past 7 days to 90 days ahead
3. Search by title or attendee email
4. Delete events (cancellation notifications sent to attendees)

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 15 | React framework with App Router |
| TypeScript | Type-safe development |
| Tailwind CSS | Styling |
| Google Gemini AI | Natural language processing |
| Google Calendar API | Event management |
| Google OAuth 2.0 | Authentication |

---

## Project Structure

```
bscs-calendar-automation/
├── app/
│   ├── api/
│   │   ├── auth/              # OAuth handling
│   │   ├── calendar/          # Event CRUD operations
│   │   └── parse/             # AI parsing endpoint
│   ├── lib/
│   │   ├── gemini.ts          # Gemini AI integration
│   │   └── googleCalendar.ts  # Google Calendar API
│   ├── types/                 # TypeScript interfaces
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── .env.example
├── package.json
└── README.md
```

---

## Security Notes

- Access tokens stored in `localStorage` (demo only)
- For production: use HTTP-only cookies or server-side sessions
- Never commit `.env.local` to version control
- Add test users in Google Cloud Console OAuth consent screen

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "This app isn't verified" | Add your email under "Test users" in OAuth consent screen |
| Token expired | Click "Disconnect" then "Connect Google" to re-authenticate |
| Events not appearing | Verify correct Google account and Calendar API is enabled |

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/NewFeature`)
3. Commit changes (`git commit -m 'Add NewFeature'`)
4. Push to branch (`git push origin feature/NewFeature`)
5. Open a Pull Request

---

## License

Open source and available for educational purposes.

---

## Support

For issues or suggestions, open an issue on GitHub.
