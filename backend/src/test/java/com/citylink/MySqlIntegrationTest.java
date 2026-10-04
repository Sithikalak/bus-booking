package com.citylink;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;

/** Exercises HTTP, validation, services, JPA, row locks and an actual MySQL database. */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
@SpringBootTest(
  webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
  properties = {
    "spring.datasource.url=${TEST_DB_URL}",
    "spring.datasource.username=${TEST_DB_USERNAME}",
    "spring.datasource.password=${TEST_DB_PASSWORD}",
    "app.development=true",
    "app.tracking-simulation=false",
    "spring.jpa.hibernate.ddl-auto=validate",
  }
)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class MySqlIntegrationTest {

  @Autowired
  TestRestTemplate http;

  @Autowired
  JdbcTemplate db;

  @Autowired
  ObjectMapper json;

  String admin, operator, passenger, support, driver, other;
  final AtomicInteger day = new AtomicInteger(
    40 + new java.security.SecureRandom().nextInt(5000)
  );
  final String run = UUID.randomUUID().toString().substring(0, 8);
  int duration;

  @BeforeAll
  void sessions() {
    assertThat(db.queryForObject("SELECT DATABASE()", String.class)).contains(
      "test"
    );
    admin = login("admin@citylink.com");
    operator = login("operator@citylink.com");
    passenger = login("passenger@citylink.com");
    support = login("support@citylink.com");
    driver = login("driver@citylink.com");
    other = register("other-" + run, "PASSENGER")
      .path("token")
      .asText();
    duration = db.queryForObject(
      "SELECT MAX(minutes_from_departure) FROM route_stops WHERE route_id=1",
      Integer.class
    );
  }

  record Reply(int status, JsonNode body) {
    JsonNode data() {
      return body.path("data");
    }
  }

  Reply request(String method, String path, String token, Object body) {
    var headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    if (token != null) headers.setBearerAuth(token);
    var response = http.exchange(
      "/api" + path,
      HttpMethod.valueOf(method),
      new HttpEntity<>(body, headers),
      JsonNode.class
    );
    return new Reply(response.getStatusCode().value(), response.getBody());
  }

  JsonNode ok(String method, String path, String token, Object body) {
    var r = request(method, path, token, body);
    assertThat(r.status())
      .as(path + " " + r.body())
      .isEqualTo(200);
    assertThat(r.body().path("success").asBoolean()).isTrue();
    return r.data();
  }

  void failure(Reply r, String code) {
    assertThat(r.status()).isBetween(400, 499);
    assertThat(r.body().path("errorCode").asText()).isEqualTo(code);
  }

  String login(String email) {
    return ok(
      "POST",
      "/auth/login",
      null,
      Map.of("email", email, "password", "CityLink2026!")
    )
      .path("token")
      .asText();
  }

  JsonNode challenge(String name, String role) {
    return ok(
      "POST",
      "/auth/register",
      null,
      Map.of(
        "firstName",
        "Test",
        "lastName",
        "Passenger",
        "email",
        name + "@example.com",
        "phone",
        "+94771111111",
        "password",
        "SecureTest2026!",
        "role",
        role
      )
    );
  }

  JsonNode register(String name, String role) {
    var c = challenge(name, role);
    return ok(
      "POST",
      "/auth/verify",
      null,
      Map.of(
        "challengeId",
        c.path("challengeId").asText(),
        "code",
        c.path("devCode").asText()
      )
    );
  }

  Map<String, Object> schedule() {
    var start = LocalDate.now(ZoneId.of("Asia/Colombo"))
      .plusDays(day.getAndIncrement())
      .atTime(8, 0);
    return new HashMap<>(
      Map.of(
        "routeId",
        1,
        "busId",
        1,
        "driverId",
        3,
        "conductorId",
        4,
        "departure",
        start.toString(),
        "arrival",
        start.plusMinutes(duration).toString(),
        "fare",
        1850,
        "status",
        "PUBLISHED",
        "confirmChanges",
        false
      )
    );
  }

  JsonNode trip() {
    return ok("POST", "/schedules", operator, schedule());
  }

  JsonNode hold(long trip, String token) {
    long seat = db.queryForObject(
      "SELECT MIN(seat_id) FROM trip_seats WHERE trip_id=? AND status='AVAILABLE'",
      Long.class,
      trip
    );
    return ok(
      "POST",
      "/trips/" + trip + "/holds",
      token,
      Map.of("seatId", seat)
    );
  }

  Map<String, Object> checkout(JsonNode h, String gateway) {
    return Map.of(
      "holdToken",
      h.path("holdToken").asText(),
      "passengerName",
      "Test Passenger",
      "passengerPhone",
      "+94771111111",
      "method",
      "MOCK_ONLINE",
      "paymentToken",
      gateway,
      "idempotencyKey",
      UUID.randomUUID().toString()
    );
  }

  JsonNode book(long id, String gateway) {
    return ok(
      "POST",
      "/payments/checkout",
      passenger,
      checkout(hold(id, passenger), gateway)
    ).path("booking");
  }

  JsonNode refundFixture(String gateway) {
    var t = trip();
    var b = book(t.path("id").asLong(), gateway);
    ok(
      "POST",
      "/schedules/" + t.path("id").asLong() + "/cancel",
      operator,
      Map.of("confirmChanges", true)
    );
    return ok(
      "POST",
      "/refunds",
      passenger,
      Map.of("bookingId", b.path("id").asLong(), "reason", "Cancelled journey")
    );
  }

  @Test
  void registrationCreatesAccountOnlyAfterValidVerification() {
    String email = "verify-" + run;
    var c = challenge(email, "PASSENGER");
    assertThat(
      db.queryForObject(
        "SELECT COUNT(*) FROM users WHERE email=?",
        Integer.class,
        email + "@example.com"
      )
    ).isZero();
    String wrong = c.path("devCode").asText().equals("000000")
      ? "999999"
      : "000000";
    failure(
      request(
        "POST",
        "/auth/verify",
        null,
        Map.of("challengeId", c.path("challengeId").asText(), "code", wrong)
      ),
      "INVALID_CODE"
    );
    assertThat(
      db.queryForObject(
        "SELECT attempts FROM challenges WHERE public_id=?",
        Integer.class,
        c.path("challengeId").asText()
      )
    ).isEqualTo(1);
    var session = ok(
      "POST",
      "/auth/verify",
      null,
      Map.of(
        "challengeId",
        c.path("challengeId").asText(),
        "code",
        c.path("devCode").asText()
      )
    );
    assertThat(session.path("user").path("verified").asBoolean()).isTrue();
    assertThat(session.toString()).doesNotContain("passwordHash");
    assertThat(
      db.queryForObject(
        "SELECT password_hash FROM users WHERE email=?",
        String.class,
        email + "@example.com"
      )
    ).startsWith("$2a$");
  }

  @Test
  void seededAndCreatedTimetablesKeepSriLankaWallClockTime() {
    var seeded = db.queryForObject(
      "SELECT departure FROM trips WHERE id=1",
      LocalDateTime.class
    );
    var apiTime = LocalDateTime.parse(
      ok("GET", "/trips/1", null, null).path("departure").asText()
    );
    assertThat(apiTime).isEqualTo(seeded);
    var payload = schedule();
    long id = ok("POST", "/schedules", operator, payload).path("id").asLong();
    assertThat(
      db.queryForObject(
        "SELECT departure FROM trips WHERE id=?",
        LocalDateTime.class,
        id
      )
    ).isEqualTo(LocalDateTime.parse(payload.get("departure").toString()));
  }

  @Test
  void staffRegistrationRequiresApprovalAndCannotElevateItself() {
    var s = register("employee-" + run, "OPERATOR");
    assertThat(s.path("pendingApproval").asBoolean()).isTrue();
    assertThat(s.path("token").isNull()).isTrue();
    failure(
      request(
        "POST",
        "/auth/login",
        null,
        Map.of(
          "email",
          "employee-" + run + "@example.com",
          "password",
          "SecureTest2026!"
        )
      ),
      "ACCOUNT_INACTIVE"
    );
    var invalid = request(
      "POST",
      "/auth/register",
      null,
      Map.of(
        "firstName",
        "Bad",
        "lastName",
        "Role",
        "email",
        "bad-" + run + "@example.com",
        "phone",
        "+94771111111",
        "password",
        "SecureTest2026!",
        "role",
        "ADMIN"
      )
    );
    assertThat(invalid.status()).isBetween(400, 499);
  }

  @Test
  void invalidLoginAndUnauthorizedRequestsAreRejected() {
    failure(
      request(
        "POST",
        "/auth/login",
        null,
        Map.of("email", "nobody-" + run + "@example.com", "password", "wrong")
      ),
      "INVALID_CREDENTIALS"
    );
    assertThat(request("GET", "/bookings", null, null).status()).isEqualTo(401);
    assertThat(request("GET", "/users", passenger, null).status()).isEqualTo(
      403
    );
    assertThat(
      request("POST", "/schedules", passenger, schedule()).status()
    ).isEqualTo(403);
  }

  @Test
  void logoutRevokesTokenAtServer() {
    String token = register("logout-" + run, "PASSENGER")
      .path("token")
      .asText();
    ok("POST", "/auth/logout", token, Map.of());
    assertThat(request("GET", "/auth/me", token, null).status()).isEqualTo(401);
  }

  @Test
  void passwordRecoveryChecksCodeAndRevokesPreviousSessions() {
    String name = "reset-" + run;
    var s = register(name, "PASSENGER");
    var c = ok(
      "POST",
      "/auth/recover",
      null,
      Map.of("email", name + "@example.com")
    );
    ok(
      "POST",
      "/auth/reset",
      null,
      Map.of(
        "challengeId",
        c.path("challengeId").asText(),
        "code",
        c.path("devCode").asText(),
        "password",
        "Replaced2026!"
      )
    );
    assertThat(
      request("GET", "/auth/me", s.path("token").asText(), null).status()
    ).isEqualTo(401);
    assertThat(
      ok(
        "POST",
        "/auth/login",
        null,
        Map.of("email", name + "@example.com", "password", "Replaced2026!")
      )
        .path("token")
        .asText()
    ).isNotBlank();
  }

  @Test
  void expiredVerificationCanBeResent() {
    var c = challenge("expired-" + run, "PASSENGER");
    String id = c.path("challengeId").asText();
    db.update(
      "UPDATE challenges SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 SECOND,resend_after=UTC_TIMESTAMP()-INTERVAL 1 SECOND WHERE public_id=?",
      id
    );
    failure(
      request(
        "POST",
        "/auth/verify",
        null,
        Map.of("challengeId", id, "code", c.path("devCode").asText())
      ),
      "CODE_EXPIRED"
    );
    var resent = ok("POST", "/auth/resend", null, Map.of("challengeId", id));
    assertThat(
      ok(
        "POST",
        "/auth/verify",
        null,
        Map.of("challengeId", id, "code", resent.path("devCode").asText())
      )
        .path("token")
        .asText()
    ).isNotBlank();
  }

  @Test
  void twoPassengersCompetingForOneSeatGetExactlyOneHold() throws Exception {
    long id = trip().path("id").asLong();
    long seat = db.queryForObject(
      "SELECT MIN(seat_id) FROM trip_seats WHERE trip_id=?",
      Long.class,
      id
    );
    var gate = new CountDownLatch(1);
    var pool = Executors.newFixedThreadPool(2);
    try {
      var a = pool.submit(() -> {
        gate.await();
        return request(
          "POST",
          "/trips/" + id + "/holds",
          passenger,
          Map.of("seatId", seat)
        );
      });
      var b = pool.submit(() -> {
        gate.await();
        return request(
          "POST",
          "/trips/" + id + "/holds",
          other,
          Map.of("seatId", seat)
        );
      });
      gate.countDown();
      var answers = List.of(
        a.get(30, TimeUnit.SECONDS),
        b.get(30, TimeUnit.SECONDS)
      );
      assertThat(
        answers
          .stream()
          .filter(r -> r.status() == 200)
          .count()
      ).isEqualTo(1);
      failure(
        answers
          .stream()
          .filter(r -> r.status() != 200)
          .findFirst()
          .orElseThrow(),
        "SEAT_UNAVAILABLE"
      );
    } finally {
      pool.shutdown();
    }
    assertThat(
      db.queryForObject(
        "SELECT COUNT(*) FROM trip_seats WHERE trip_id=? AND status='HELD'",
        Integer.class,
        id
      )
    ).isEqualTo(1);
  }

  @Test
  void expiryReleasesSeatOnBackendAndPersistsNotification() {
    long id = trip().path("id").asLong();
    var h = hold(id, passenger);
    String token = h.path("holdToken").asText();
    assertThat(
      Duration.between(
        Instant.parse(h.path("serverTime").asText()),
        Instant.parse(h.path("expiresAt").asText())
      ).toSeconds()
    ).isBetween(599L, 600L);
    db.update(
      "UPDATE trip_seats SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 SECOND WHERE hold_token=?",
      token
    );
    failure(request("GET", "/holds/" + token, passenger, null), "HOLD_EXPIRED");
    assertThat(
      db.queryForObject(
        "SELECT status FROM trip_seats WHERE id=?",
        String.class,
        h.path("inventoryId").asLong()
      )
    ).isEqualTo("AVAILABLE");
    assertThat(
      db.queryForObject(
        "SELECT COUNT(*) FROM notifications WHERE recipient_id=5 AND type='HOLD_EXPIRED'",
        Integer.class
      )
    ).isPositive();
    assertThat(hold(id, other).path("holdToken").asText()).isNotEqualTo(token);
  }

  @Test
  void checkoutFailureAllowsRetryAndSuccessIsIdempotent() {
    long id = trip().path("id").asLong();
    var h = hold(id, passenger);
    assertThat(
      ok("POST", "/payments/checkout", passenger, checkout(h, "mock_decline"))
        .path("status")
        .asText()
    ).isEqualTo("FAILED");
    ok("GET", "/holds/" + h.path("holdToken").asText(), passenger, null);
    var payload = checkout(h, "mock_success");
    var result = ok("POST", "/payments/checkout", passenger, payload);
    assertThat(result.path("booking").path("status").asText()).isEqualTo(
      "CONFIRMED"
    );
    var repeated = ok("POST", "/payments/checkout", passenger, payload);
    assertThat(repeated.path("booking").path("id")).isEqualTo(
      result.path("booking").path("id")
    );
    assertThat(
      db.queryForObject(
        "SELECT COUNT(*) FROM bookings WHERE trip_id=? AND status='CONFIRMED'",
        Integer.class,
        id
      )
    ).isEqualTo(1);
    assertThat(
      db.queryForObject(
        "SELECT status FROM trip_seats WHERE id=?",
        String.class,
        h.path("inventoryId").asLong()
      )
    ).isEqualTo("BOOKED");
  }

  @Test
  void anotherPassengerCannotPayOrReadSomeoneElsesBooking() {
    long id = trip().path("id").asLong();
    var h = hold(id, passenger);
    assertThat(
      request(
        "POST",
        "/payments/checkout",
        other,
        checkout(h, "mock_success")
      ).status()
    ).isEqualTo(403);
    var b = ok(
      "POST",
      "/payments/checkout",
      passenger,
      checkout(h, "mock_success")
    ).path("booking");
    assertThat(
      request("GET", "/bookings/" + b.path("id").asLong(), other, null).status()
    ).isEqualTo(403);
  }

  @Test
  void expiredHoldCannotCreateBookingOrCharge() {
    long id = trip().path("id").asLong();
    var h = hold(id, passenger);
    db.update(
      "UPDATE trip_seats SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 SECOND WHERE id=?",
      h.path("inventoryId").asLong()
    );
    failure(
      request(
        "POST",
        "/payments/checkout",
        passenger,
        checkout(h, "mock_success")
      ),
      "HOLD_EXPIRED"
    );
    assertThat(
      db.queryForObject(
        "SELECT COUNT(*) FROM bookings WHERE trip_id=?",
        Integer.class,
        id
      )
    ).isZero();
  }

  @Test
  void resourceConflictsAreRejectedWithoutSaving() {
    var input = schedule();
    var saved = ok("POST", "/schedules", operator, input);
    failure(
      request("POST", "/schedules", operator, input),
      "SCHEDULE_CONFLICT"
    );
    assertThat(
      db.queryForObject(
        "SELECT COUNT(*) FROM trips WHERE departure=? AND bus_id=1",
        Integer.class,
        LocalDateTime.parse(input.get("departure").toString())
      )
    ).isEqualTo(1);
    var driverOnly = new HashMap<>(input);
    driverOnly.put("busId", 2);
    driverOnly.put("conductorId", 8);
    failure(
      request("POST", "/schedules", operator, driverOnly),
      "SCHEDULE_CONFLICT"
    );
    var conductorOnly = new HashMap<>(input);
    conductorOnly.put("busId", 2);
    conductorOnly.put("driverId", 7);
    failure(
      request("POST", "/schedules", operator, conductorOnly),
      "SCHEDULE_CONFLICT"
    );
    assertThat(saved.path("stops").get(0).path("eta").asText()).isNotBlank();
  }

  @Test
  void concurrentScheduleAssignmentsCannotDoubleBookResources()
    throws Exception {
    var payload = schedule();
    var gate = new CountDownLatch(1);
    var pool = Executors.newFixedThreadPool(2);
    try {
      var a = pool.submit(() -> {
        gate.await();
        return request("POST", "/schedules", operator, payload);
      });
      var b = pool.submit(() -> {
        gate.await();
        return request("POST", "/schedules", operator, payload);
      });
      gate.countDown();
      var replies = List.of(
        a.get(30, TimeUnit.SECONDS),
        b.get(30, TimeUnit.SECONDS)
      );
      assertThat(
        replies
          .stream()
          .filter(r -> r.status() == 200)
          .count()
      ).isEqualTo(1);
      failure(
        replies
          .stream()
          .filter(r -> r.status() != 200)
          .findFirst()
          .orElseThrow(),
        "SCHEDULE_CONFLICT"
      );
    } finally {
      pool.shutdown();
    }
  }

  @Test
  void bookedScheduleNeedsExplicitConfirmationAndNotifiesPassengers() {
    var payload = schedule();
    long id = ok("POST", "/schedules", operator, payload).path("id").asLong();
    book(id, "mock_success");
    payload.put("fare", 2000);
    failure(
      request("PUT", "/schedules/" + id, operator, payload),
      "CONFIRM_CHANGES"
    );
    payload.put("confirmChanges", true);
    ok("PUT", "/schedules/" + id, operator, payload);
    failure(
      request(
        "POST",
        "/schedules/" + id + "/cancel",
        operator,
        Map.of("confirmChanges", false)
      ),
      "CONFIRM_CHANGES"
    );
    ok(
      "POST",
      "/schedules/" + id + "/cancel",
      operator,
      Map.of("confirmChanges", true)
    );
    assertThat(
      db.queryForObject(
        "SELECT COUNT(*) FROM notifications WHERE recipient_id=5 AND type='CANCELLATION'",
        Integer.class
      )
    ).isPositive();
  }

  @Test
  void cancelledTripRefundCompletesAndCannotBeProcessedTwice() {
    var f = refundFixture("mock_success");
    long id = f.path("id").asLong();
    var completed = ok(
      "POST",
      "/refunds/" + id + "/review",
      support,
      Map.of("approve", true)
    );
    assertThat(completed.path("status").asText()).isEqualTo("COMPLETED");
    failure(
      request(
        "POST",
        "/refunds/" + id + "/review",
        support,
        Map.of("approve", true)
      ),
      "REFUND_REVIEWED"
    );
    assertThat(
      db.queryForObject(
        "SELECT status FROM payments WHERE booking_id=?",
        String.class,
        f.path("bookingId").asLong()
      )
    ).isEqualTo("REFUNDED");
  }

  @Test
  void refundGatewayRetriesOnceThenEscalates() {
    var f = refundFixture("mock_refund_fail");
    var failed = ok(
      "POST",
      "/refunds/" + f.path("id").asLong() + "/review",
      support,
      Map.of("approve", true)
    );
    assertThat(failed.path("status").asText()).isEqualTo("FAILED");
    assertThat(failed.path("attempts").asInt()).isEqualTo(2);
    assertThat(
      db.queryForObject(
        "SELECT COUNT(*) FROM notifications WHERE recipient_id=1 AND title='Refund needs administrator attention'",
        Integer.class
      )
    ).isPositive();
    assertThat(
      request(
        "POST",
        "/refunds/" + f.path("id").asLong() + "/retry",
        support,
        Map.of()
      ).status()
    ).isEqualTo(403);
  }

  @Test
  void refundRejectionRequiresAndPersistsReason() {
    var f = refundFixture("mock_success");
    String path = "/refunds/" + f.path("id").asLong() + "/review";
    failure(
      request("POST", path, support, Map.of("approve", false, "reason", "")),
      "REASON_REQUIRED"
    );
    var rejected = ok(
      "POST",
      path,
      support,
      Map.of(
        "approve",
        false,
        "reason",
        "Duplicate compensation already issued"
      )
    );
    assertThat(rejected.path("status").asText()).isEqualTo("REJECTED");
    assertThat(rejected.path("rejectionReason").asText()).isNotBlank();
  }

  @Test
  void nonCancelledTripCannotBeRefunded() {
    var b = book(trip().path("id").asLong(), "mock_success");
    failure(
      request(
        "POST",
        "/refunds",
        passenger,
        Map.of("bookingId", b.path("id").asLong(), "reason", "Changed plans")
      ),
      "REFUND_INELIGIBLE"
    );
  }

  @Test
  void trackingRequiresBookingRetainsLastLocationAndNotifiesDelay() {
    long id = trip().path("id").asLong();
    book(id, "mock_success");
    db.update(
      "INSERT INTO gps_samples(trip_id,latitude,longitude,speed,progress,recorded_at) VALUES (?,7.08,80.08,48,0.24,UTC_TIMESTAMP())",
      id
    );
    assertThat(
      ok("GET", "/tracking/" + id, passenger, null)
        .path("gpsStatus")
        .asText()
    ).isEqualTo("AVAILABLE");
    failure(
      request("GET", "/tracking/" + id, other, null),
      "TRACKING_FORBIDDEN"
    );
    ok(
      "PUT",
      "/tracking/" + id,
      operator,
      Map.of("status", "IN_TRANSIT", "delayMinutes", 15, "gpsAvailable", false)
    );
    var t = ok("GET", "/tracking/" + id, passenger, null);
    assertThat(t.path("gpsStatus").asText()).isEqualTo("LAST_KNOWN");
    assertThat(t.path("position").path("latitude").asDouble()).isEqualTo(7.08);
    assertThat(
      db.queryForObject(
        "SELECT COUNT(*) FROM notifications WHERE recipient_id=5 AND type='DELAY'",
        Integer.class
      )
    ).isPositive();
  }

  @Test
  void crewAcknowledgesDutyAndUrgentIncidentsReachOperator() {
    long id = trip().path("id").asLong();
    assertThat(
      ok("POST", "/trips/" + id + "/acknowledge", driver, Map.of())
        .path("driverAcknowledged")
        .asBoolean()
    ).isTrue();
    var incident = ok(
      "POST",
      "/incidents",
      driver,
      Map.of(
        "busId",
        1,
        "type",
        "BRAKES",
        "description",
        "Inspection required",
        "priority",
        "URGENT"
      )
    );
    assertThat(incident.path("priority").asText()).isEqualTo("URGENT");
    assertThat(
      db.queryForObject(
        "SELECT COUNT(*) FROM notifications WHERE recipient_id=2 AND title='URGENT vehicle incident'",
        Integer.class
      )
    ).isPositive();
    assertThat(
      ok(
        "PUT",
        "/incidents/" + incident.path("id").asLong(),
        operator,
        Map.of("status", "RESOLVED")
      )
        .path("status")
        .asText()
    ).isEqualTo("RESOLVED");
  }

  @Test
  void supportResponseAndNotificationReadStatePersist() {
    var s = ok(
      "POST",
      "/customer-service",
      passenger,
      Map.of(
        "category",
        "COMPLAINT",
        "subject",
        "Test concern",
        "description",
        "Please review this journey"
      )
    );
    var reply = ok(
      "PUT",
      "/customer-service/" + s.path("id").asLong(),
      support,
      Map.of("status", "RESOLVED", "response", "Your concern was reviewed.")
    );
    assertThat(reply.path("response").asText()).isEqualTo(
      "Your concern was reviewed."
    );
    var n = ok("GET", "/notifications?size=1", passenger, null)
      .path("items")
      .get(0);
    ok(
      "PUT",
      "/notifications/" + n.path("id").asLong(),
      passenger,
      Map.of("read", true)
    );
    assertThat(
      db.queryForObject(
        "SELECT is_read FROM notifications WHERE id=?",
        Boolean.class,
        n.path("id").asLong()
      )
    ).isTrue();
    assertThat(
      request(
        "PUT",
        "/notifications/" + n.path("id").asLong(),
        other,
        Map.of("read", true)
      ).status()
    ).isEqualTo(403);
  }

  @Test
  void adminCanDisableAccountsButInvalidRoleChangesRollback() {
    var u = register("managed-" + run, "PASSENGER");
    long id = u.path("user").path("id").asLong();
    var input = new HashMap<String, Object>(
      Map.of(
        "firstName",
        "Managed",
        "lastName",
        "User",
        "email",
        "managed-" + run + "@example.com",
        "phone",
        "+94771111111",
        "role",
        "ROOT",
        "status",
        "ACTIVE",
        "verified",
        true,
        "permissions",
        List.of()
      )
    );
    failure(request("PUT", "/users/" + id, admin, input), "INVALID_ROLE");
    assertThat(
      db.queryForObject("SELECT role FROM users WHERE id=?", String.class, id)
    ).isEqualTo("PASSENGER");
    input.put("role", "PASSENGER");
    input.put("status", "DISABLED");
    ok("PUT", "/users/" + id, admin, input);
    assertThat(
      request("GET", "/auth/me", u.path("token").asText(), null).status()
    ).isEqualTo(401);
  }
}
