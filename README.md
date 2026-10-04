# CityLink Express

A connected bus scheduling and booking application for Metro Travel Lanka: React → Spring Boot → MySQL. The six documented workflows are mapped in [requirements](docs/REQUIREMENTS.md); endpoint details are in [API contract](docs/API.md).

## What is included

- Dark, responsive passenger website with an original animated Three.js coach, route search, a dimensional seat cabin, a server-timed 10-minute hold, checkout, QR boarding pass, saved journeys and tracking.
- Registration, expiring verification codes, recovery, profile editing and JWT sessions with database-enforced roles and capabilities.
- Admin/operator workspace: schedules, route stops, fleet, staff availability, assignments, booking records, incident escalation, customer service, refunds, notifications and reports.
- Java 21 / Spring Boot 3.5 backend with validation, transaction locking, consistent errors, BCrypt and Spring Security; MySQL schema, constraints, indexes and useful demonstration records.
- Tests for authorization, concurrency, seat expiration, scheduling, payment/refund alternatives and other documented workflows.

## Run locally

Requirements: Java 21, Maven 3.6.3 or later, MySQL 8, Node.js 22.12 or later (tested with Node 24), and npm. MySQL Workbench is convenient but optional. No Docker or external service account is needed.

### 1. Create and seed the database

Open `database/citylink_express.sql` in MySQL Workbench and execute it against your local server. It creates `citylink_express` and all tables, then inserts demonstration data. Run it once on a **new** database; it intentionally does not drop existing data. Dates are relative to the day the script is run. To demonstrate future trips after the seed dates have passed, create schedules in the operator dashboard.

Using an administrator connection, create an application user. Replace the password placeholder with your own password before running:

```sql
CREATE USER 'citylink'@'localhost' IDENTIFIED BY '<choose-your-own-password>';
GRANT SELECT, INSERT, UPDATE, DELETE ON citylink_express.* TO 'citylink'@'localhost';
```

`database/schema.sql` contains the schema without demo records. Use the full script for the guided demo. The application validates the schema on startup; it does not create or silently change it.

### 2. Start the backend

In PowerShell, from the project folder:

```powershell
$env:DB_URL='jdbc:mysql://localhost:3306/citylink_express?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true'
$env:DB_USERNAME='citylink'
$env:DB_PASSWORD='<the-password-you-chose>'
$env:FRONTEND_ORIGIN='http://127.0.0.1:5173'
mvn -f backend/pom.xml spring-boot:run
```

Keep this terminal running. Health check: `http://127.0.0.1:8080/api/health`.

Alternatively, build with `mvn -f backend/pom.xml package` and run `java -jar backend/target/citylink-express.jar` with the same environment settings. A compiled JAR is supplied separately with the deliverables.

### 3. Start the frontend

In a second PowerShell terminal, from the project folder:

```powershell
cd frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. Use that exact address: the backend checks the configured frontend origin on browser requests. The Vite development server forwards `/api` to port 8080.

If those ports are occupied, set `PORT` and `FRONTEND_ORIGIN` before starting Java, and set `BACKEND_URL` and `FRONTEND_PORT` before starting npm. Example: backend `PORT=8088`, `FRONTEND_ORIGIN=http://127.0.0.1:5178`; frontend `BACKEND_URL=http://127.0.0.1:8088`, `FRONTEND_PORT=5178`. Restart the affected server after changing these values.

Environment variables must be set in the process that launches the application. `.env.example` is a reference; Spring Boot does not automatically load it.

## Demonstration accounts

These are intentionally public local-demo credentials from the seed script. Password for each: **CityLink2026!**

| Email | Role / starting point |
|---|---|
| passenger@citylink.com | Search, book, view tickets, track and request support |
| admin@citylink.com | All operational screens and user access management |
| operator@citylink.com | Scheduling, resources, fleet and operational monitoring |
| driver@citylink.com | Assigned duties, acknowledgement and tracking controls |
| conductor@citylink.com | Assigned duties and incident reporting |
| support@citylink.com | Customer requests and refund reviews |

New passengers verify a code shown in the development UI. Staff registrations remain pending until an admin activates them. Admin and customer-service roles are provisioned through the admin users screen.

## Guided demonstration

1. Sign in as the passenger. Search for a future trip, choose an available seat, and continue while the hold timer is running. Fill passenger details and use the development payment option. A successful checkout produces a persisted booking and QR ticket.
2. Use test card `4242 4242 4242 4242` for success, `4000 0000 0000 0002` for decline, or `4000 0000 0000 3220` for a successful payment whose later refund fails. Supply a future expiry and any three-digit test CVV. **Mock online** succeeds without card fields. A decline keeps the unexpired hold so checkout can be retried. The backend receives a mock token, never card details. Use synthetic details only.
3. Open **My journeys → View ticket**. Download the portable HTML ticket, or use **Print** and select Save as PDF. **Track bus** shows the route schematic, position, ETA and last-known-location fallback.
4. Sign in as the operator in another browser session. Create a draft schedule, choose available resources, then publish it. Try overlapping an assigned bus or crew member to see the conflict message. Major changes to a booked trip require confirmation and notify passengers.
5. To demonstrate refunds, cancel a booked trip as the operator. The passenger can request a refund from support. The customer-service account approves or rejects it. Failed mock refunds retry once, then escalate to an admin for retry.
6. Drivers/conductors acknowledge assignments and report incidents. High-priority reports are prominent and create operations notifications. Admins can change user access, inspect reports and manage resources.

## Configuration and provider boundaries

| Variable | Default / purpose |
|---|---|
| DB_URL / DB_USERNAME / DB_PASSWORD | MySQL connection; password has no default |
| PORT / SERVER_ADDRESS | 8080 / 127.0.0.1 |
| FRONTEND_ORIGIN | http://127.0.0.1:5173; exact browser origin |
| JWT_SECRET | Optional in development; otherwise a random key is generated on startup, invalidating old sessions after restart. A supplied secret must be at least 32 bytes. |
| APP_DEVELOPMENT | true; enables the explicitly marked local providers |
| TRACKING_SIMULATION | true; polls and stores simulated GPS samples every 15 seconds |
| FRONTEND_PORT / BACKEND_URL | Vite: 5173 / http://127.0.0.1:8080 |

This is a functional local development edition. It does not charge money, send email/SMS, contact physical GPS hardware or load a commercial map service.

- **Payments:** `service/PaymentGateway.java` defines the boundary; `MockPaymentGateway` implements deterministic success/failure and idempotent refunds. Add a real provider bean and read its credentials from server environment variables. A real integration must verify provider callbacks, tokenize payment details using that provider's browser SDK and reconcile asynchronous results; adding a key alone is insufficient.
- **Verification:** implement `VerificationProvider` with an email/SMS transport and server-side credentials. `DevelopmentVerificationProvider` exposes codes only through development responses. In-app notifications are durable database records; external delivery needs its own provider.
- **GPS:** implement `GpsProvider` using authenticated telemetry and route progress. The simulator interpolates route stops and respects reported delay. Active samples are compared with the timetable; changes of at least five minutes update ETA and notify passengers. Wire production polling or ingestion in `TrackingJob`/`TrackingService`; `TRACKING_SIMULATION=false` deliberately stops the development feed and preserves last known positions.
- **Map:** `frontend/src/components/RouteMap.tsx` is a geographic route schematic, not a street/navigation map. Replace it with a licensed map SDK if needed; restrict any browser-visible map key by origin.

Do not switch `APP_DEVELOPMENT=false` expecting real integrations to appear: provider implementations and a JWT secret are required. Before public use, replace seed identities, configure HTTPS and deployment secrets, and add distributed rate limiting, provider monitoring, backups and operational reconciliation. Browser tokens use session storage. Authentication throttling is local to one server process.

## Data and concurrency

Timetables are Asia/Colombo local date-times; holds, verification and session clocks are UTC instants. Fares use decimal LKR. Direct JDBC date-time handling preserves local timetable values, and UTC connection settings keep expiration instants consistent.

Unique trip/seat inventory rows and a locked trip record serialize holds and checkout. Resource assignment uses a database mutex across competing schedule updates. MySQL READ COMMITTED ensures a transaction that waited for a lock sees the winner's committed state. Inventory is released on access and periodic expiration cleanup. Payment checkout uses an idempotency key; failures never confirm a seat. Password and role changes invalidate sessions through account token versions.

Routes have ordered stops; trips reference one route, bus, driver and conductor. Bus seats produce per-trip inventory. Bookings connect passengers, seats and payment records. Separate records hold refunds, support requests, incidents, notifications, verification challenges and GPS samples. See the SQL files for foreign keys and indexes.

## Build and test

```powershell
mvn -f backend/pom.xml test
npm --prefix frontend test
npm --prefix frontend run build
```

The default Maven run executes unit tests and skips MySQL integration tests unless `TEST_DB_URL` is provided. For the full suite, prepare a **separate disposable test database**: copy `database/citylink_express.sql`, change its `CREATE DATABASE` and `USE` names from `citylink_express` to `citylink_test`, and execute that copy. Grant a test user read/write access only to that database. Then:

```powershell
$env:TEST_DB_URL='jdbc:mysql://localhost:3306/citylink_test?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true'
$env:TEST_DB_USERNAME='<test-database-user>'
$env:TEST_DB_PASSWORD='<test-database-password>'
mvn -f backend/pom.xml test
```

The integration suite checks for a test database name, makes real HTTP calls and commits test records. Never point it at a database holding wanted application data. It covers registration/verification/recovery, authorization and revocation, simultaneous seat holds, expiry, checkout decline/retry/idempotency, overlapping resource assignments, schedule changes, cancellation notifications, refund alternatives, tracking ownership, incidents and support. Tests can be rerun with fresh unique records.

For a deployable frontend, `npm run build` writes `frontend/dist`. Serve it with an SPA fallback to `index.html` and reverse-proxy `/api` to the Java server on the same public origin. Vite's development proxy is not production hosting.

## Troubleshooting

- **Login fails while public data loads:** ensure `FRONTEND_ORIGIN` exactly matches the browser address, including localhost versus 127.0.0.1 and port.
- **Backend cannot connect:** confirm MySQL is running, the port and database name are right, and the application account has access. Import the schema before starting Java.
- **No journeys on a chosen day:** seed schedules cover a limited future window; create and publish a new schedule with available resources.
- **Session expires after restart:** the development JWT key is generated per run unless `JWT_SECRET` is configured. Sign in again.
- **Dependency download certificate error:** use a trusted network or have your administrator install the correct trusted CA. Keep certificate verification enabled.
- **Port already in use:** choose alternate ports using the four settings above. Do not stop unrelated services.

## Project layout

```text
frontend/src/   pages, components, hooks, context, API client and styles
backend/src/    controllers, DTOs, services, repositories, entities, security and tests
database/      MySQL schema and seed data
docs/          requirement mapping and API contract
README.md      setup, demonstration, testing and integration guidance
```
