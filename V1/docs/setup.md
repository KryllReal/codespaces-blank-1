# Maxitom Standalone Deployment & Setup Guide

Maxitom is a high-performance, standalone Cloudflare Worker designed for secure script distribution. It features a built-in dashboard, D1 database integration, and advanced protection layers (RVM, XXTEA, Anti-Skid).

---

## 1. Prerequisites
- **Cloudflare Account**: [Sign up here](https://dash.cloudflare.com/sign-up)
- **Node.js 18+ & npm**: [Download here](https://nodejs.org/)
- **Wrangler CLI**: Installed via npm (`npm install -g wrangler`)

---

## 2. Initial Setup
1. Extract the project files.
2. Open your terminal in the `export/` directory.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Authenticate with Cloudflare:
   ```bash
   npx wrangler login
   ```

---

## 3. Database Configuration (Cloudflare D1)
Maxitom uses Cloudflare D1 for session management, user tracking, and script metadata.

1. **Create the Database**:
   ```bash
   npx wrangler d1 create maxitom_db
   ```
   *Copy the `database_id` from the output.*

2. **Configure `wrangler.toml`**:
   Open `wrangler.toml` and replace the placeholder `database_id` with yours:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "maxitom_db"
   database_id = "YOUR_DATABASE_ID_HERE"
   ```

3. **Initialize Schema**:
   Deploy the tables to your live database:
   ```bash
   npx wrangler d1 execute maxitom_db --file=./schema.sql --remote
   ```
   *(Optional) For local development testing, run without `--remote`.*

---

## 4. Environment Secrets
Secrets are encrypted environment variables stored on Cloudflare's servers. You **must** set these for the application to function.

| Secret Name | Description | Required |
|-------------|-------------|----------|
| `ADMIN_KEY` | Master key to access `/zen` and initial setup. | **Yes** |
| `DISCORD_CLIENT_ID` | OAuth Client ID for Discord login. | Optional |
| `DISCORD_CLIENT_SECRET` | OAuth Client Secret for Discord login. | Optional |
| `DISCORD_REDIRECT_URI` | `https://<your-domain>/api/auth/discord/callback` | Optional |
| `MAXITOM_LOG_WEBHOOK` | Discord Webhook URL for system logs. | Optional |

**Commands to set secrets**:
```bash
npx wrangler secret put ADMIN_KEY
# (Follow prompts to enter your secure key)

# Optional Discord Setup
npx wrangler secret put DISCORD_CLIENT_ID
npx wrangler secret put DISCORD_CLIENT_SECRET
npx wrangler secret put DISCORD_REDIRECT_URI
npx wrangler secret put MAXITOM_LOG_WEBHOOK
```

---

## 5. Dashboard Customization
- **Ad-Network**: Open `public/checkpoint.html` and replace `https://example.com/your-ad-link-here` with your Linkvertise/AdGate URL.
- **Origins**: If hosting the frontend on a separate domain, add it to `ALLOWED_ORIGINS` in `src/shared/constants.js`.
- **Branding**: Update `public/index.html` and `public/checkpoint.html` titles/icons as desired.

---

## 6. Deployment
Once configured, deploy your worker to the global Cloudflare edge network:
```bash
npm run deploy
```

---

## 7. First Access & Hardening
1. Navigate to `https://<your-worker-subdomain>.workers.dev/zen`.
   - *Note: If you haven't set a custom domain, use your worker URL.*
2. You will be prompted for your `ADMIN_KEY`.
3. Go to the **Profile** tab to:
   - Setup **Discord OAuth** (allows one-click login).
   - Enable **2FA (TOTP)** for maximum security.
4. From the **Admins** tab, you can add additional staff members.

---

## Troubleshooting
- **401 Unauthorized**: Check your `ADMIN_KEY` or session cookie.
- **500 Internal Error**: Check `npx wrangler tail` to see live error logs.
- **Database Errors**: Ensure you ran `db:init` and that the `database_id` in `wrangler.toml` matches your D1 instance.
- **Import Resolution Errors**: If the build fails due to `Could not resolve '../shared/...'`, ensure the import paths in `src/handlers.js` are relative to the file's actual location (usually `./shared/` if they are siblings).
- **Pages _worker.js Conflict**: If you see an error about `Uploading a Pages _worker.js file`, remove or rename any `_worker.js` files inside the `public/` directory, as this is a Worker with Assets project, not a Pages project.

---

## 8. Verified Deployment Log (Reference)
The following commands were used to successfully deploy this instance:
1. **Dependencies**: `npm install`
2. **DB Create**: `npx wrangler d1 create maxitom_db`
3. **DB Init**: `npx wrangler d1 execute maxitom_db --file=./schema.sql --remote`
4. **Secrets**: `npx wrangler secret put ADMIN_KEY` (Value: `c9d21cbcae55219f9c5e53bf0571530c`)
5. **Deploy**: `npm run deploy`
