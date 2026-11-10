# Free hosted demo

The full stack (Kafka, Redis, MongoDB, API, worker, web) runs locally with `docker compose up`. A public demo does not need all of it: the event bus and job queue have in-process implementations (see [ARCHITECTURE.md](ARCHITECTURE.md), "Queue layer"), so the hosted version runs on three free tiers and nothing else.

```mermaid
flowchart LR
  B[Browser] --> V["Vercel (free)<br/>Next.js web<br/>/api/* proxy"]
  V --> R["Render (free)<br/>Express API + inline worker<br/>EVENT_BUS=memory"]
  R --> A[("MongoDB Atlas M0 (free)")]
  R -. optional .-> G{{Gemini API free tier}}
```

| Part | Service | Cost |
|---|---|---|
| Web (Next.js) | Vercel Hobby | free |
| API + worker (one process) | Render free web service (Docker) | free; sleeps after 15 min idle, first request takes ~30–60 s to wake |
| Database | MongoDB Atlas M0 (512 MB) | free |
| LLM (optional) | Gemini API free tier | free; without a key the offline heuristic provider is used |

What changes compared with the local stack: Kafka is replaced by the in-memory bus, and BullMQ jobs run in-process. Behaviour is the same; durability is not (a job in flight is lost if the instance restarts), which is acceptable for a read-mostly demo whose data is seeded.

## 1. MongoDB Atlas

1. Create a free **M0** cluster at cloud.mongodb.com.
2. *Database Access*: add a user with read/write access.
3. *Network Access*: allow `0.0.0.0/0` (Render's free tier has no fixed outbound IP).
4. Copy the connection string and add the database name: `mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/strata?retryWrites=true&w=majority`.

## 2. Seed the database (once, from your machine)

The seed runs the real ingestion pipeline over the public-data snapshot in `data/seed`:

```bash
npm install
MONGO_URL="mongodb+srv://…/strata" npm run seed
```

It does nothing if the database already has data (`SEED_RESET=true` starts over).

## 3. API on Render

1. On render.com: *New → Blueprint*, pick this repository. Render reads [`render.yaml`](../render.yaml).
2. Fill in the values it asks for:
   - `MONGO_URL`: the Atlas string from step 1.
   - `CORS_ORIGINS`: the Vercel URL from step 4 (you can set it after the first web deploy).
   - `GEMINI_API_KEY`: optional.
3. Deploy, then open `https://<service>.onrender.com/api/health`.

## 4. Web on Vercel

1. *Add New → Project*, import this repository.
2. **Root Directory:** `apps/web` (framework: Next.js).
3. **Environment variable:** `API_URL=https://<service>.onrender.com`. It is read at build time by the `/api/*` rewrite, so redeploy after changing it.
4. Deploy, then put the Vercel URL into `CORS_ORIGINS` on Render.

Sign in with `viewer@strata.local` / `strata-demo-2026` (or the analyst and admin accounts in the README).

## Notes

- **Proxy hops.** A request reaches the API through Vercel, Cloudflare and two Render proxies (`X-Forwarded-For: client, vercel, cloudflare, render-internal`), so `TRUST_PROXY_HOPS=4` makes rate limits key on the visitor's address. Too low a value keys on a random edge address; too high lets clients spoof `X-Forwarded-For`. Check the header in the request logs if the hosting path changes.
- **Cold starts and restarts.** The sign-in form retries for up to 90 seconds while the API wakes, and the landing page pings `/api/health` on load so the API is usually awake by the time a visitor clicks Sign in.
- **Sign-up is off** in the hosted demo (`ALLOW_SIGNUP=false`); visitors use the seeded accounts.
- **Live connectors.** Running the SEC connector from the admin console needs `SEC_USER_AGENT` set to a real contact; leave it unset to keep the demo on the snapshot.
- **Cold starts.** Put a note on any link you share: the first load after idle takes up to a minute while Render wakes the API.
