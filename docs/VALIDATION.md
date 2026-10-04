# Validation record — 22 September 2026

Verified locally with Java 21.0.11, MySQL 8.0.46, Node 24.19 and the committed npm lockfile.

| Check | Result |
|---|---|
| Spring Boot Maven package | Passed; executable JAR produced |
| Backend unit tests | 7 passed |
| HTTP / real MySQL integration tests | 23 passed, none skipped in full run |
| Frontend payment-validation tests | 3 passed |
| TypeScript and production frontend build | Passed |
| Browser: passenger sign-in, seat hold, passenger details, mock payment, QR ticket | Passed; booking persisted and dashboard count increased |
| Browser: booked-trip tracking | Passed; route, saved GPS sample, ETA and simulation label visible |
| Browser: admin sign-in, metrics, routes and stop editor | Passed |
| Browser: mobile dashboard | Passed; cards and navigation adapt, no document-level horizontal overflow |
| Browser: mobile landing page | Passed; hero, coach and booking action adapt without horizontal overflow |

The frontend build reports the lazy-loaded Three.js chunk at approximately 506 kB before compression (127 kB gzip). The application and routes are split into separate chunks; the warning does not prevent the build.

The browser check found and corrected a mismatch between the local preview address and the backend's permitted origin. The default now matches the documented `127.0.0.1:5173` address. Real database tests also verified fixes for MySQL snapshot isolation during competing seat holds and timetable date-time conversion.

External payment, messaging, hardware GPS and map-provider connections were not tested: the delivered application uses the documented development adapters. Browser smoke checks complement the automated suite; they are not a claim of exhaustive accessibility or device certification.
