# API contract

Base `/api`. JSON responses: `{success, message, data}`; failures: `{success:false,message,errorCode}`. Authentication uses `Authorization: Bearer <token>`. Login/verification return `{token,user}`; user has `id,firstName,lastName,email,phone,role,status,verified,permissions`. No entity is serialized directly. Dates are ISO strings, money is decimal LKR. Lists use `{items,page,size,total}` where paginated.

| Method / path | Request | Access / response |
|---|---|---|
| POST /auth/register | firstName,lastName,email,phone,password,role | Public; challengeId, devCode in development only |
| POST /auth/verify | challengeId,code | Public; token/user or pending-approval status |
| POST /auth/resend | challengeId | Public; new challenge code |
| POST /auth/login | email,password | Public; session |
| POST /auth/recover | email | Public; generic acknowledgement, challengeId |
| POST /auth/reset | challengeId,code,password | Public; invalidates existing sessions |
| POST /auth/logout | none | Authenticated; invalidates all account tokens |
| GET /auth/me; PUT /users/me | profile fields for PUT | Current account |
| GET, POST /users; PUT /users/{id} | user fields, role,status,verified,permissions | Admin; paginated search and account management |
| GET /public/summary | none | Public aggregate counts from database |
| GET /routes; GET /trips | origin,destination,date,time,page,size | Public routes and published future trips |
| GET /trips/{id}; GET /trips/{id}/seats | none | Public trip and inventory (no hold owner disclosure) |
| GET /schedules; POST /schedules; PUT /schedules/{id} | routeId,busId,driverId,conductorId,departure,arrival,fare,status,confirmChanges | Scheduling capability; stop ETAs calculated |
| POST /schedules/{id}/cancel | confirmChanges | Scheduling capability; notification and refund eligibility |
| POST /trips/{id}/acknowledge | none | Assigned staff |
| POST /trips/{id}/holds | seatId | Passenger; inventoryId,holdToken,expiresAt,serverTime |
| DELETE /holds/{token}; GET /holds/{token} | none | Hold owner; release/status |
| POST /payments/checkout | holdToken,passengerName,passengerPhone,method,paymentToken,idempotencyKey | Passenger; status,booking,message. Tokens: mock_success, mock_decline, mock_refund_fail |
| GET /bookings; GET /bookings/{id} | page,size | Owner or authorized staff; ticket and payment info |
| GET /tracking/{tripId} | none | Booked passenger / assigned staff / authorized operations |
| PUT /tracking/{tripId} | status,delayMinutes,gpsAvailable | Assigned driver or operations |
| GET, POST /buses; PUT /buses/{id} | registration,model,capacity,type,features,status | Fleet capability; generated seats on create |
| GET /staff; PUT /staff/{id} | licenseNumber,available | Fleet capability / own duty view |
| GET /staff/availability | departure,arrival,excludeTripId | Scheduling/fleet capability; available resources |
| POST, PUT /routes[/{id}] | name,origin,destination,distanceKm,active,stops:[{name,latitude,longitude,minutesFromDeparture}] | Scheduling capability |
| GET, POST /incidents; PUT /incidents/{id} | busId,type,description,priority; status for PUT | Staff report, fleet resolves |
| GET, POST /customer-service; PUT /customer-service/{id} | category,subject,description; status,response for PUT | Owner creates/views; service staff responds |
| GET, POST /refunds | bookingId,reason for POST | Owner requests; service staff sees all |
| POST /refunds/{id}/review | approve,reason | Service staff; full fare or rejection |
| POST /refunds/{id}/retry | none | Admin; failed refund retry |
| GET /notifications; PUT /notifications/{id} | read | Owner only |
| GET /dashboard; GET /reports | none | Operations/report capability; database aggregates |

Capabilities are selected from a role-specific allowlist. Removing a capability revokes access immediately. ADMIN has all capabilities. No endpoint trusts role or identity sent by the browser.
