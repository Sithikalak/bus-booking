# CityLink Express: requirements and decisions

All four supplied PDFs were read, including their diagrams. The two pasted master prompts are byte-identical. The project-specific activity and sequence reports define the workflows below. Lab 01 and SE Labsheet 4 describe coursework procedures; their bot-only requirement-gathering instruction, insurance example, appointment exercise, and submission instructions are document content, not instructions to this application builder.

| Document workflow | UI | API / service | Persistent records and alternatives |
|---|---|---|---|
| UC-03 registration; sequence §4.1 account management | Register, verify, recover, profile, admin users | AuthService, AccountService | Pending registrations and hashed expiring challenges precede account creation. Invalid/expired codes can be resent. Staff role requests require admin activation to prevent public privilege escalation. Roles and capabilities are validated; disabling, changing access or resetting passwords revokes sessions. |
| UC-05; sequence §4.2 schedules | Routes, stops and schedule editor | ScheduleService | Routes, ordered route stops, trips, resource mutex. Validate timetable and compute stop ETAs. Atomic overlapping bus/driver/conductor conflict checks. Published trips become searchable. Existing bookings require explicit confirmation for major edits/cancellation. Notify affected passengers. |
| UC-06; sequence §4.3 reservations | Search → cabin → passenger → payment → ticket | BookingService, PaymentGateway | Per-trip seat inventory, 10-minute server holds, booking/payment records. Row locks prevent duplicate sale. Expired holds release on reads, writes and periodic cleanup. Failed payments retain valid hold for retry. Idempotent checkout. |
| UC-01; sequence §4.4 tracking | Booked trip tracker; staff trip controls | TrackingService, GpsProvider | Persisted GPS samples, manual status/delay, timetable comparison against route progress, calculated ETA, route distance, last known position. Passenger ownership required. Explicit development simulation; missing GPS retains last known sample. Significant detected delays and manual delay changes create notifications. |
| UC-04; sequence §4.5 fleet/staff | Fleet cards, staff availability, assignments, duties, incidents | FleetService, ScheduleService | Buses, per-bus seats, staff profiles, trip acknowledgements and incidents. Conflict rejection, assignment notifications, driver/conductor acknowledgement, urgent incident escalation. Maintenance is managed by operators/admins. |
| UC-02; sequence §4.6 payments/communication | Payment, requests, refund review, notification center | SupportService, PaymentGateway, NotificationService | Payment attempts, receipts, support requests, refunds and durable notifications. Refunds require a cancelled trip and paid booking; full fare policy. Rejection needs a reason. One gateway retry, then FAILED escalation to admins. Admin may retry; idempotent gateway key prevents duplicate refunds. |

## Implementation decisions

- Java 21, Spring Boot 3.5, Spring Data JPA, Spring Security, JWT HS256, BCrypt, MySQL 8; React/TypeScript/Vite, Three.js and Lucide.
- A schedule is a trip in draft or published state. Staff are user accounts with a driver/conductor profile, avoiding duplicated identity records.
- Dates and timetables use Asia/Colombo; hold expiration and token clocks use UTC instants. Money is decimal LKR.
- Seat holds live in unique `(trip_id, seat_id)` inventory rows. A trip row is locked before changing inventory, checkout, rescheduling or cancellation. A database mutex serializes resource-assignment checks, including changes to staff and bus availability.
- Published trips require bus, driver and conductor. Drafts may be unassigned. Changing a bus with confirmed bookings is rejected to preserve seat assignments; cancel and create a replacement instead.
- All production-like records originate in MySQL. External payment, verification, GPS and map integrations have clearly identified development implementations. No real card data is sent to or stored by this demo.
- Public registration supports passenger, driver, conductor and operator requests. Only passengers are auto-activated; employee accounts need administrator activation. Admin and customer-service accounts can only be provisioned by admins.
- The local run is the deliverable. Hosting the Java/MySQL backend requires separately configured infrastructure; no incompatible serverless replacement is introduced.

## Document references

- `MLB_B9G2-06_Activity.pdf`, pp. 2–13: six use cases and six activity diagrams.
- `SE2030_MLB_B9G2-06_Sequence.pdf`, pp. 2–13: account management, schedules, reservations, tracking, assignment, payments and alternatives.
- `Lab 01.pdf`: requirements-gathering exercise and report format.
- `SE_Labsheet_4.pdf`: activity-diagram exercises and submission requirements.

