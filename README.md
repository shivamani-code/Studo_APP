# 🎓 Studo – Next-Gen Student Life & Attendance

A student "operating system" for tracking attendance, planning leaves, building habits and managing tasks – with AI-powered attendance advice and cloud sync, wrapped in a dark, modern UI.

🔗 **Live demo:** https://studo-app.vercel.app

## ✨ Features

- **Accounts** – email/password sign-up and login with Supabase Auth
- **Dashboard (CORE)** – overview of subjects and semester attendance
- **Attendance calendar** – mark and review attendance day by day
- **Reports & Analytics** – attendance reports and subject-wise charts (Recharts)
- **Forecast / Leave planner** – simulate planned leaves and see if you stay above the **75%** attendance threshold
- **AI attendance advice** – sends your attendance stats to a Supabase Edge Function that returns 2–3 sentences of actionable advice (via OpenRouter)
- **Focus space** – Pomodoro-style productivity hub, courses and an exam/queue list
- **Habit tracker** – daily and monthly habit tracking
- **Task manager** – tasks with today's highlights and recent activity
- **Academic queue** – upcoming and past important dates
- **Profile**
- **Cloud sync** – data is stored locally per user and synced to Supabase (`studo_user_data` table)
- **Subscriptions** – Razorpay checkout, subscription status and webhook handled by Edge Functions
- **Contact form** on the landing page (stored via an Edge Function)
- **Installable PWA** – web manifest, app icons and a service worker
- **Android app** – a Kotlin WebView wrapper (`android/`) that loads the web app, with an option to bundle it as local assets

## 🛠️ Tech Stack

| Area | Tech |
|------|------|
| Frontend | React 19, TypeScript, Vite 6 |
| UI | Framer Motion, Lucide icons, Recharts |
| Routing | React Router 7 |
| Backend | Supabase (Auth, Postgres, Edge Functions on Deno) |
| AI | OpenRouter chat completions (from the `ai-attendance-advice` function) |
| Payments | Razorpay |
| CI | GitHub Actions – deploys Edge Functions on push |

## 📁 Project Structure

```
Studo_APP/
├── App.tsx / index.tsx        # App shell, auth session, routing, cloud sync
├── components/                # Dashboard, AttendanceCalendar, LeavePlanner, AIPredictor,
│                              # Analytics, HabitTracker, TaskManager, PersonalSpace, Profile…
├── services/                  # dataService, cloudDataService, billingService,
│                              # contactService, gemini (AI advice), supabaseClient
├── supabase/
│   ├── functions/             # ai-attendance-advice, billing-create-subscription,
│   │                          # billing-status, contact-submit, razorpay-webhook
│   └── *.sql                  # studo_user_data, billing, contact_messages tables
├── .github/workflows/         # Edge Function deploy workflow
├── android/                   # Android WebView app (Kotlin, Gradle)
└── public/
```

## 🚀 Run Locally

**Prerequisites:** Node.js 18+ and a Supabase project.

```bash
git clone https://github.com/shivamani-code/Studo_APP.git
cd Studo_APP
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

```bash
npm run dev
```

Other scripts: `npm run build`, `npm run preview`, `npm run typecheck`, `npm run verify` (typecheck + build).

**Backend (optional)** – run the SQL files in `supabase/` on your project and deploy the Edge Functions:

```bash
supabase functions deploy ai-attendance-advice --project-ref <your-ref>
```

The AI function reads `OPENROUTER_API_KEY` (or `GEMINI_API_KEY`) from your Supabase function secrets. The deploy workflow expects `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` repository secrets.

## 📱 Android App

The `android/` folder is a WebView wrapper (`com.studo.webview`). Open it in Android Studio, or build from the command line:

```bash
cd android
./gradlew assembleDebug
```

The web URL it loads is set in `android/app/src/main/res/values/strings.xml` (`web_app_url`); set `use_local_assets` in `res/values/bools.xml` to load bundled assets instead.
