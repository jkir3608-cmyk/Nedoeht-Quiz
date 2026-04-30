# Nedoeht-Quiz

## Overview

A full-stack Blooket-inspired quiz platform called Nedoeht-Quiz. Features AI-powered quiz creation, real-time multiplayer games, a unique Coin-Quest game mode, and admin controls.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + Framer Motion
- **Real-time**: WebSocket (ws library at `/api/ws`)
- **Auth**: Session-based (express-session + bcryptjs)
- **AI**: OpenAI via Replit AI Integrations (gpt-5-mini)

## Artifacts

- **nedoeht-quiz** (frontend) — React + Vite at `/`
- **api-server** (backend) — Express at `/api`

## Key Features

- Quiz creation with AI question generation and explanation generation
- Coin-Quest game mode: answer 3 questions correctly → open 1 of 3 chests for rewards
- Skill vs Luck scale (1–5) controls reward randomness
- Host and Player screens with real-time WebSocket communication
- Admin view (password: `2026BIOlogy!`) to kick players and edit coins
- Locked premium game modes (Tower Defense, Factory, etc.)
- AI-generated explanations shown after each question

## Pages

- `/` — Landing page with join code input
- `/login` — Login/Register
- `/dashboard` — Dashboard with stats and recent games
- `/quizzes` — My quizzes and public discovery
- `/create` — Create quiz with AI assistant
- `/quiz/:quizId/edit` — Edit quiz
- `/game-modes` — Game mode selector
- `/host/:quizId` — Host game setup (skill/luck scale)
- `/host/lobby/:gameId` — Host lobby with join code display
- `/host/game/:gameId` — Host game view with admin controls
- `/join` — Player join with game code
- `/play/:gameId/:playerId` — Player game screen
- `/results/:gameId` — End screen leaderboard

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## WebSocket Protocol

WebSocket at `/api/ws?gameId=X&role=host|player&playerId=Y`

**Client → Server:** `ping`, `answer`, `open-chest`, `next-question`, `start-game`, `kick-player`, `admin-update-coins`  
**Server → Client:** `pong`, `player-joined`, `player-list`, `game-started`, `question`, `answer-result`, `show-chests`, `chest-result`, `leaderboard`, `game-ended`, `player-kicked`, `coins-updated`

## Admin Password

`2026BIOlogy!`

## Environment Variables

- `SESSION_SECRET` — Session encryption key
- `DATABASE_URL` — PostgreSQL connection string
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Replit AI proxy URL
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit AI proxy key
