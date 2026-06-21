# Hisab Kitab — Apna Register, Digital

Restaurant order, billing, aur khata management for small/local restaurants —
built to replace the paper register, not to overwhelm the owner with a full
POS suite.

## What's in here

```
hisab-kitab/
├── schema.sql          ← MySQL schema, run this first
├── backend/             ← Express API (multi-tenant, restaurant_id isolated)
└── frontend/            ← React (Vite + Tailwind), mobile-first UI
```

## Architecture

- **Multi-tenant**: every business table carries `restaurant_id`. One MySQL
  database serves every restaurant — same pattern as GymKaro's `gym_id` /
  the pharmacy SaaS's `shop_id`.
- **Auth**: JWT-based. Owners log in with phone + password. Staff (waiters/
  cashiers) log in with a 4-6 digit PIN against a shared device — no separate
  phone numbers needed per staff member.
- **Core flow**: `orders` → `order_items` → `payments`, with a running
  `khata` balance per customer phone number for credit. `expenses` is a
  simple daily log. `dashboard/summary` aggregates all of it into the one
  screen an owner actually checks each evening.

## Running locally

### 1. Database
```bash
mysql -u root < schema.sql
mysql -u root -e "CREATE USER 'hisab_app'@'localhost' IDENTIFIED BY 'your_password';
                   GRANT ALL PRIVILEGES ON hisab_kitab.* TO 'hisab_app'@'localhost';"
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env   # fill in your DB password and a real JWT_SECRET
npm run dev             # nodemon, restarts on change
```
Runs on `http://localhost:4000`.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173`, talking to the backend via `VITE_API_URL`
in `frontend/.env`.

## Deploying (zero-cost start, same pattern as GymKaro)

- **Frontend** → Netlify or Vercel, point `VITE_API_URL` at your deployed
  backend URL.
- **Backend** → needs a small VPS or a Node host (Render free tier works for
  testing; webhooks/always-on workloads will eventually want a real VPS,
  same call you'll make for GymKaro).
- **Database** → any managed MySQL (PlanetScale, Railway, or your own VPS's
  MySQL). Keep `hisab_app`'s password and `JWT_SECRET` out of git — they're
  already in `.gitignore` via `.env`.

## Phase 2 (not built yet, deliberately)

- KOT to kitchen via Telegram, n8n-triggered — same n8n + MySQL pattern as
  GymKaro/pharmacy.
- Bridge into Heera Paneer Wala for restaurants that graduate to wanting
  WhatsApp/QR customer ordering.
- GST-compliant invoice formatting toggle.

These were left out on purpose — the pitch to a register-and-pen owner is
"hum aapka register replace karte hain," not a feature list. Phase 2 is the
upsell once they trust the basics.
