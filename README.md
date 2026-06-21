# Bank Queue Management System (BQMS)

A modern, trilingual digital queue management platform tailored for Sri Lankan bank branches. BQMS replaces paper-based queuing with a single, highly concurrent transactional Queue Engine powering five dedicated UI surfaces in real time.

---

## 🚀 Key Features & UI Surfaces

1. **Customer Web App (Public)**
   - Service selection and appointment booking (15-minute intervals).
   - Live ticket tracking and dynamic wait time estimation.
   - Trilingual support (English, Sinhala, Tamil) with session persistence.
   - Feedback submission upon service completion.

2. **Teller Console (Staff-facing)**
   - Unified ticket calling panel (Next, Call, Recall, Done, Transfer, No-show).
   - Real-time waiting list counters (Appointments, Priority, Standard).
   - Break management with SLA timers.

3. **Branch Manager Dashboard (Staff-facing)**
   - Live overview of all active counters and queue depths.
   - SLA threshold alerts (visual breach cues).
   - Teller reallocation and queue rebalancing tools.

4. **Hall Display Board (Public, In-Branch)**
   - High-contrast, accessibility-first split screen ("Now Serving" & "Next Up").
   - Voice announcements cycling sequentially through Sinhala, Tamil, and English.

5. **Head Office Admin Portal (Staff-facing)**
   - Multi-branch administration and tenant provisioning.
   - Staff invite flow (HO Admin triggers Supabase invites for branch managers/tellers).
   - Historical analytics, no-show locks, and SLA thresholds.

---

## 🛠️ Technology Stack

- **Core Framework**: Next.js 16.2 (App Router & TypeScript) & React 19
- **Database**: Supabase (Postgres with transactional row locking)
- **ORM**: Drizzle ORM (for serverless-friendly schema management)
- **Realtime Sync**: Supabase Realtime (Logical replication/WebSockets)
- **Internationalization**: next-intl (English `en`, Sinhala `si`, Tamil `ta`)
- **Styling**: Tailwind CSS & shadcn/ui (Radix primitives)
- **Scheduled Jobs**: Vercel Cron (triggering automated sweeps every 1 minute)
- **Validation**: Zod (type-safe environment variables and API contracts)

---

## 📦 Local Installation & Setup

Follow these steps to clone and spin up the project locally:

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/Bank-Queue-Management-System.git
cd "Bank Queue Management System"
```

### 2. Install Dependencies
Run npm install in the root folder of the project to download all necessary dependencies:
```bash
npm install
```

### 3. Configure Environment Variables
Copy the template `.env.example` into a local environment file:
```bash
cp .env.example .env.local
```
Then, edit `.env.local` to fill in your real Supabase credentials and database strings:
- `DATABASE_URL`: Connection string to your Supabase Postgres database.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Found in your Supabase dashboard (Project Settings → API).
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (used for server-only actions like auth invites).

### 4. Run Migrations & Seeding (Database Setup)
Once your database environment variables are configured in `.env.local`, set up the schema using Drizzle ORM:
```bash
# Generate SQL migrations from schema
npx drizzle-kit generate

# Push schemas directly to Supabase Postgres
npx drizzle-kit push
```

### 5. Run the Development Server
Start the Next.js dev server:
```bash
npm run dev
```

### 6. Seed Auth Users (Test Accounts)

Create test users for all three staff roles:

```bash
npm run db:seed-auth
```

This creates the following accounts in Supabase Auth:

| Role               | Email              | Password      |
|--------------------|--------------------|---------------|
| Head Office Admin  | admin@bqms.lk      | Admin@123     |
| Branch Manager     | manager@bqms.lk    | Manager@123   |
| Teller             | teller@bqms.lk     | Teller@123    |

---

## 🖥️ Viewing the System

Once the dev server starts successfully:
1. Open your browser and navigate to: **[http://localhost:3000](http://localhost:3000)**.
2. Click **Sign in** (top-right) and use one of the test credentials above.
3. The initial codebase serves the default landing page. As the project development progresses through its roadmap, the public and protected UI routes will become active:
   - **Customer Web App**: `/branch/[branchId]`
   - **Teller Console**: `/teller`
   - **Manager Dashboard**: `/manager`
   - **Hall Display Board**: `/display/[branchId]`
   - **HO Admin Portal**: `/admin`

