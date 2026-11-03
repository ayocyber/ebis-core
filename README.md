# EBIS Core (working name)

Tender eligibility and bid preparation for SMEs. One Laravel 12 project with React + TypeScript pages through Inertia (Laravel React starter kit).

Build spec: https://claude.ai/artifact/JAaHB4KaBmpL3AxFDhDk42

## Run it locally (Windows)

Needs Laravel Herd (PHP 8.4) and Node 22. Herd's PHP 8.4 must come first on PATH (an older PHP 8.1 in `C:\php81` is also installed).

```bash
composer install
npm install
cp .env.example .env      # first time only
php artisan key:generate  # first time only
php artisan migrate
composer run dev          # server, queue, logs and Vite together
```

Open http://localhost:8000, create an account, then create your company.

Development uses SQLite (`database/database.sqlite`). Switch to MySQL 8 before phase 1 (full-text search).

## Checks (same as CI)

```bash
vendor/bin/pint --test
vendor/bin/phpstan analyse --memory-limit=1G
npx tsc --noEmit
npx eslint resources/js
vendor/bin/pest
```

## Where things are

| Path | What |
| --- | --- |
| `app/Support/Tenancy` | `CurrentTenant` and the `BelongsToTenant` trait: every company-owned model uses it |
| `app/Http/Middleware/SetCurrentTenant.php` | Picks the signed-in user's company; no company → onboarding |
| `app/Enums/TenantRole.php` | Owner, Editor, Viewer |
| `resources/js/pages` | React pages, one folder per area |
| `tests/Feature/Tenancy/TenantIsolationTest.php` | SEC-01: add a case here for every new company-owned model |

## Phase status

- [x] Phase 0: starter kit, companies (tenants), roles, company switcher, members and invitations, tenant isolation tests, CI
- [ ] Phase 1: ingest (upload, ZIP packs, text extraction, OCR)
