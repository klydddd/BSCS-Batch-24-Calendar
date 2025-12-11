# 📅 BSCS Calendar Automation

A powerful AI-powered calendar automation tool built for **BSCS Batch 2025**. Transform your to-do lists and class schedules into Google Calendar events with just a few clicks, and send invites to your entire class automatically.

![Next.js](https://img.shields.io/badge/Next.js-15.1.0-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-AI-purple?style=flat-square&logo=google)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3-38B2AC?style=flat-square&logo=tailwind-css)

---

## ✨ Features

### 🤖 AI-Powered Parsing
- Uses **Google Gemini 2.5 Flash** to intelligently parse natural language
- Automatically detects events vs. tasks
- Handles multiple items from a single input (bullet points, numbered lists, etc.)
- Prepends course/class names to event titles

### 📨 Multi-Recipient Invites
- Add multiple classmates' emails at once
- Paste entire email lists (separated by spaces, commas, or newlines)
- Recipients receive calendar invites automatically
- No need for others to log in - just accept the invite!

### 📋 Event Management
- View all your upcoming events in one place
- Search events by title or attendee
- Delete events with cancellation notifications to all attendees
- Open events directly in Google Calendar

### 🎨 Modern UI
- Glassmorphism design with animated backgrounds
- Dark mode optimized
- Fully responsive
- Real-time feedback and loading states

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Cloud Project with:
  - Calendar API enabled
  - OAuth 2.0 credentials
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
   
   Create a `.env.local` file in the root directory:
   ```env
   # Google Gemini API Key
   # Get from: https://aistudio.google.com/apikey
   GEMINI_API_KEY=your_gemini_api_key

   # Google OAuth Credentials
   # Get from: https://console.cloud.google.com/apis/credentials
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret

   # Your app URL (for OAuth callback)
   NEXTAUTH_URL=http://localhost:3000
   ```

4. **Configure Google Cloud Console**
   
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable the **Google Calendar API**
   - Create OAuth 2.0 credentials (Web application)
   - Add authorized redirect URI: `http://localhost:3000/api/auth/callback`
   - Add your email as a test user in OAuth consent screen

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## 📖 How to Use

### Creating Events

1. **Connect your Google account** - Click "Connect Google" and authorize the app

2. **Add recipients** (optional) - Paste your classmates' emails:
   ```
   classmate1@gmail.com
   classmate2@gmail.com, friend@outlook.com
   another@email.com
   ```

3. **Paste your to-do list** - Use natural language:
   ```
   PEF3
   - Final Requirement: Practice Assessment (submit video by Dec 12)
   - MyClass Course Evaluation (until Dec. 12)
   - Non-main Performers Performance (on Dec. 12)
   - Main Performers Performance (on Dec. 12)
   ```

4. **Click the ⚡ button** - AI will parse your input into structured events

5. **Review and create** - Select which items to add, then click "Add Selected & Send Invites"

### Managing Events

1. Switch to the **"Manage Events"** tab
2. View all your events from the past 7 days to 90 days ahead
3. Search by title or attendee email
4. Click the 🗑️ trash icon to delete an event (cancellation notifications will be sent to all attendees)

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 15** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **Tailwind CSS** | Styling and responsive design |
| **Google Gemini AI** | Natural language processing |
| **Google Calendar API** | Event creation and management |
| **Google OAuth 2.0** | Secure authentication |

---

## 📁 Project Structure

```
bscs-calendar-automation/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── route.ts          # OAuth URL generation
│   │   │   └── callback/
│   │   │       └── route.ts      # OAuth callback handler
│   │   ├── calendar/
│   │   │   ├── route.ts          # Create events/tasks
│   │   │   └── events/
│   │   │       ├── route.ts      # List events
│   │   │       └── [eventId]/
│   │   │           └── route.ts  # Delete event
│   │   └── parse/
│   │       └── route.ts          # AI parsing endpoint
│   ├── lib/
│   │   ├── gemini.ts             # Gemini AI integration
│   │   └── googleCalendar.ts     # Google Calendar API
│   ├── types/
│   │   └── calendar.ts           # TypeScript interfaces
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main application
├── .env.example                  # Environment template
├── package.json
└── README.md
```

---

## 🔒 Security Notes

- Access tokens are stored in `localStorage` (for demo purposes)
- For production, implement secure HTTP-only cookies or server-side sessions
- Never commit `.env.local` to version control
- OAuth consent screen is in "Testing" mode - add test users in Google Cloud Console

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is open source and available for educational purposes.

---

## 👥 Made for BSCS Batch 2025

Built with ❤️ to make life easier for BSCS students. No more manual calendar entries!

---

## 🐛 Troubleshooting

### "This app isn't verified" error
- Go to Google Cloud Console → OAuth consent screen
- Add your email under "Test users"

### Token expired
- Click "Disconnect" then "Connect Google" to re-authenticate

### Events not appearing
- Make sure you're logged into the correct Google account
- Check if the Calendar API is enabled in your Google Cloud Console

---

## 📞 Support

If you encounter any issues or have suggestions, please open an issue on GitHub.
