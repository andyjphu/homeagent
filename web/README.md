# FoyerFind — Web Frontend

Next.js 16 + React 19 + TypeScript + Tailwind CSS + shadcn/ui

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Structure

- `src/app/(agent)/` — Agent command center (protected, requires Supabase auth)
- `src/app/(buyer)/` — Buyer private dashboard (token-based access, no auth)
- `src/app/(auth)/` — Login/signup pages
- `src/app/api/` — API routes
- `src/lib/llm/` — LLM integration (Cerebras + Gemini, optional)
- `src/lib/supabase/` — Supabase client wrappers

See `/CLAUDE.md` at the project root for build priorities and conventions.
