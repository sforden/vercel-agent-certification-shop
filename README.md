# Vercel Agent Foundations Certification

### Assignment: Store Agents

A Next.js storefront for the Vercel Swag Store API with two AI agents built on the AI SDK, Vercel Workflows, and Vercel Sandbox.

- **Shopping agent** (storefront chat, robot icon in the header) helps customers find products, inspect items, and request returns.
- **Store admin agent** (`/admin`) helps employees investigate support, returns, inventory, and sales, computes results in Vercel Sandbox, and remembers useful context between conversations.

The two agents have separate API routes, workflows, tools, and chat UIs. Back-office tools and the bash sandbox are only available to the admin agent.

## Tech stack

- **Next.js 16** (App Router) with **React 19**
- **TypeScript** (`strict`), `@/*` path alias → project root
- **Tailwind CSS v4** + **shadcn/ui**; `lucide-react` icons
- **AI SDK** (`ai`, `@ai-sdk/react`) with **AI Elements** for both chat UIs
- **Vercel Workflows** (`workflow`, `@ai-sdk/workflow`) for durable agent runs
- **Vercel Sandbox** (`@vercel/sandbox`) for admin computation and memory
- **Vercel AI Gateway** for model access (`anthropic/claude-sonnet-5`)
- **pnpm**

## Getting started

Prerequisites are a Vercel account, Node.js 22+ (LTS), [pnpm](https://pnpm.io), and the Vercel CLI.

```bash
pnpm install
npm install --global vercel   # skip if already installed
vercel login
vercel link                   # select your existing project
vercel env pull .env.local    # pulls BYPASS_SECRET, API_BASE_URL, and VERCEL_OIDC_TOKEN
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Open the shopping chat with the robot icon in the header. Visit `/admin` and sign in with the demo password `letmeinadminagent` to use the admin chat.

The local `VERCEL_OIDC_TOKEN` expires after 12 hours. Rerun `vercel env pull .env.local` when model or sandbox calls start failing with auth errors.

## Environment variables

All variables are server-only. Never commit `.env.local` or give secrets a `NEXT_PUBLIC_` prefix.

| Variable | Required | Purpose |
| --- | --- | --- |
| `BYPASS_SECRET` | Yes | Vercel deployment-protection bypass secret for the store API. Sent as the `x-vercel-protection-bypass` header. Prepopulated by the Deploy link. |
| `API_BASE_URL` | Yes | Base URL of the Vercel Swag Store API. Prepopulated by the Deploy link. |
| `VERCEL_OIDC_TOKEN` | Local dev | Authenticates AI Gateway and Vercel Sandbox locally. Pulled by `vercel env pull`; provided automatically when deployed on Vercel. |
| `AI_GATEWAY_API_KEY` | No | Alternative to OIDC for AI Gateway. If set, add it in Vercel for Development, Preview, and Production. |
| `NEXT_PUBLIC_SITE_URL` | No | Public site URL used for metadata. Defaults to `http://localhost:3000`. Not a secret. |

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the dev server on http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |

## Shopping agent

**Tools** (`lib/tools.ts`)

| Tool | What it does |
| --- | --- |
| `searchProducts` | Searches the catalog by text and category, with `limit` and `page` for browsing the full catalog. |
| `getAllCategories` | Lists current categories from the API so filters are never invented. |
| `getProductDetails` | Returns the full product (description, price, images, tags, options) plus live stock. |
| `returnOrder` | Verifies the order exists, then starts the durable `returnFlow` without blocking the chat. |

**Generative UI.** `searchProducts` results render as a browsable list (`components/agent-product-list.tsx`) and `getProductDetails` as a product card (`components/agent-product-card.tsx`). Both show images, names, formatted prices, links to product pages, stock status, loading states, errors, and empty results.

**Durability.** `/api/chat` starts `chatFlow` (`lib/workflows/chat-flow.ts`), which runs a `WorkflowAgent`. Model calls and tool executions run as workflow steps, so transient failures retry and interrupted runs continue. The client stores the workflow run ID and reconnects through `/api/chat/[id]/stream` after a refresh or dropped connection, resuming without duplicate output.

**Returns.** `lib/workflows/return-flow.ts` runs look-up order, notify customer, pre-authorize refund, and file return as separate steps. A failed step retries on its own without repeating completed side effects.

**Scope.** The agent only helps with products and returns and redirects unrelated requests back to the store.

## Store admin agent

**Tools** (`lib/tools.ts`)

| Tool | What it does |
| --- | --- |
| `getSupportTickets` | Tickets filtered by date, status, priority, category, assignee, and limit. |
| `getReturnsHistory` | Returns filtered by date, status, decision, and limit, with order and refund info. |
| `getInventoryStock` | Stock filtered by product, low-stock, and availability, with pagination. |
| `getSalesAnalytics` | Units, orders, and revenue for a date range, optionally for one product. |
| `searchProducts`, `getAllCategories` | Identify products before combining back-office data. |
| `bash` | Runs commands in a persistent Vercel Sandbox. Admin-only. |

All store data access is read-only. The agent converts cents to dollars, names products, numbers, and date ranges, and never claims to change store data.

**Durability.** `/api/admin/chat` starts `adminChatFlow` (`lib/workflows/admin-chat-flow.ts`), which runs a `WorkflowAgent` with every tool and the memory read as workflow steps.

**Sandbox computation.** The agent writes fetched JSON into the sandbox and runs stdlib-only `python3` for aggregates and joins, such as per-product return rates and low-stock top sellers. The admin chat shows each command with running, output, and failure states.

**Persistent memory.** One named, persistent sandbox (`lib/sandbox.ts`) holds both memory and scripts.

- `/vercel/sandbox/memories.md` stores employee preferences, corrections, and business context. It's loaded into the agent's instructions at the start of every conversation, and a missing file is handled as "no memories yet."
- `/vercel/sandbox/scripts/*.py` stores reusable report scripts. They're logged in `memories.md` and rerun against freshly fetched data, never hardcoded numbers.

The sandbox snapshots automatically and resumes on the next request.

## Project structure

```
app/
  (store)/                     # storefront pages
  admin/                       # /admin dashboard + /admin/login (demo auth)
  api/
    chat/route.ts              # starts the shopping chatFlow
    chat/[id]/stream/route.ts  # resumes a shopping run's stream
    admin/chat/route.ts        # starts the admin adminChatFlow
lib/
  api.ts                       # typed store API client (server-only)
  types.ts, format.ts          # shared types, formatPrice()
  agent.ts                     # shopping instructions + UI message types
  tools.ts                     # all agent tools
  sandbox.ts                   # persistent Vercel Sandbox helper
  workflows/
    chat-flow.ts               # shopping WorkflowAgent
    admin-chat-flow.ts         # admin WorkflowAgent + memory
    return-flow.ts             # durable return steps
components/
  agent-chat.tsx               # shopping chat UI
  agent-product-list.tsx       # searchProducts results
  agent-product-card.tsx       # getProductDetails result
  admin-agent-chat.tsx         # admin chat UI with sandbox output
  ai-elements/                 # AI Elements components
```

## Try it

**Shopping chat**

- "What hoodies do you have?"
- "Tell me more about the first one."
- "I want to return order 11111, it doesn't fit."
- "What's the weather today?" (redirected to the store)

**Admin chat**

- "Which products have the highest return rate in the last 90 days?"
- "Which top sellers are low on stock?"
- "From now on, show rates as percentages." Then start a new chat and ask again to see the preference applied.

## Deployment

Deploys to Vercel. Pushing to the connected repo redeploys. AI Gateway and Sandbox authenticate with OIDC automatically in Vercel deployments. `images.remotePatterns` in `next.config.mjs` lists the image hosts the API uses, so add hostnames there if the API serves images from a new domain.
