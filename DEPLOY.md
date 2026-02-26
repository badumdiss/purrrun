# Deploying PURR-RUN to Vercel + Supabase

## Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)
- A [Vercel](https://vercel.com) account (free tier works)
- A [GitHub](https://github.com) account

---

## Step 1 — Set Up Supabase

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Choose a name, password, and region → **Create Project**
3. Once created, go to **SQL Editor** (left sidebar)
4. Paste the contents of `supabase/schema.sql` and click **Run**
5. Go to **Project Settings → API**
6. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` *(keep this secret)*

---

## Step 2 — Set Up Local Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Install dependencies and run locally:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to verify the game works.

---

## Step 3 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: PURR-RUN cat side-scroller"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

> Make sure `.env.local` is in `.gitignore` (it already is). Never commit secrets.

---

## Step 4 — Deploy to Vercel

### Option A: Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts. When asked about environment variables, add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Option B: Vercel Dashboard (recommended)

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Vercel auto-detects Next.js — no build config needed
4. Before clicking **Deploy**, go to **Environment Variables** and add:
   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service role key |
5. Click **Deploy** 🚀

---

## Step 5 — Verify

- Visit your Vercel URL
- Play a game and check that your score appears in the leaderboard
- In Supabase → **Table Editor → scores**, you should see rows being inserted

---

## Continuous Deployment

Every `git push` to `main` triggers an automatic redeploy on Vercel. No extra steps needed.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Invalid API key" | Double-check env vars in Vercel dashboard |
| Leaderboard empty | Verify RLS policies in Supabase (`schema.sql`) |
| Game not loading | Check browser console for errors; ensure `canvas` is supported |
| Scores not saving | Check Vercel function logs under **Deployments → Functions** |
