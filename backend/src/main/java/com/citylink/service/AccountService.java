package com.citylink.service;

import static com.citylink.util.Values.*;

import com.citylink.dto.Requests.*;
import com.citylink.entity.*;
import com.citylink.mapper.Views;
import com.citylink.repository.*;
import com.citylink.security.*;
import java.time.Instant;
import java.util.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountService {

  private final UserAccountRepository users;
  private final StaffProfileRepository staff;
  private final StaffRepository staffMembers;
  private final TripRepository trips;
  private final TripSeatRepository tripSeats;
  private final BookingRepository bookings;
  private final PaymentRepository payments;
  private final RefundRepository refunds;
  private final NotificationRepository notifications;
  private final SupportRequestRepository supportRequests;
  private final IncidentRepository incidents;
  private final TripTrackingRepository tripTrackings;
  private final ResourceMutexRepository mutex;
  private final CurrentUser current;
  private final BCryptPasswordEncoder encoder;

  public AccountService(
    UserAccountRepository users,
    StaffProfileRepository staff,
    StaffRepository staffMembers,
    TripRepository trips,
    TripSeatRepository tripSeats,
    BookingRepository bookings,
    PaymentRepository payments,
    RefundRepository refunds,
    NotificationRepository notifications,
    SupportRequestRepository supportRequests,
    IncidentRepository incidents,
    TripTrackingRepository tripTrackings,
    ResourceMutexRepository mutex,
    CurrentUser current,
    BCryptPasswordEncoder encoder
  ) {
    this.users = users;
    this.staff = staff;
    this.staffMembers = staffMembers;
    this.trips = trips;
    this.tripSeats = tripSeats;
    this.bookings = bookings;
    this.payments = payments;
    this.refunds = refunds;
    this.notifications = notifications;
    this.supportRequests = supportRequests;
    this.incidents = incidents;
    this.tripTrackings = tripTrackings;
    this.mutex = mutex;
    this.current = current;
    this.encoder = encoder;
  }

  @Transactional(readOnly = true)
  public Object list(String q, int page, int size) {
    current.require("USERS");
    String term = q.toLowerCase();
    return page(
      users
        .findAll()
        .stream()
        .filter(u ->
          (u.firstName + " " + u.lastName + " " + u.email + " " + u.role)
            .toLowerCase()
            .contains(term)
        )
        .map(Views::user)
        .toList(),
      page,
      size
    );
  }

  @Transactional
  public Object save(Long id, UserInput r) {
    current.require("USERS");
    mutex.lock();
    var u =
      id == null ? new UserAccount() : required(users.lockById(id), "Account");
    String permissions = Permissions.validate(r.role(), r.permissions());
    oneOf(r.status(), "ACTIVE", "DISABLED", "PENDING_APPROVAL");
    check(
      !r.status().equals("ACTIVE") || r.verified(),
      "VERIFICATION_REQUIRED",
      "Active accounts must be verified."
    );
    if (id != null) {
      check(
        !id.equals(current.get().id) ||
          (r.role().equals("ADMIN") &&
            r.status().equals("ACTIVE") &&
            r.verified()),
        "SELF_LOCKOUT",
        "You cannot remove your own administrator access."
      );
      boolean restrictive =
        !r.role().equals(u.role) || !r.status().equals("ACTIVE");
      if (restrictive) check(
        trips
          .findAll()
          .stream()
          .noneMatch(
            t ->
              !t.status.equals("CANCELLED") &&
              t.arrival.isAfter(localNow()) &&
              ((t.driver != null && t.driver.id.equals(id)) ||
                (t.conductor != null && t.conductor.id.equals(id)))
          ),
        "STAFF_ASSIGNED",
        "Reassign this employee's upcoming duties before changing their role or access."
      );
    }
    String email = r.email().strip().toLowerCase();
    var duplicate = users.findByEmailIgnoreCase(email);
    check(
      duplicate.isEmpty() || duplicate.get().id.equals(id),
      "EMAIL_EXISTS",
      "An account already uses this email."
    );
    u.firstName = r.firstName().strip();
    u.lastName = r.lastName().strip();
    u.email = email;
    u.phone = r.phone();
    u.role = r.role();
    u.status = r.status();
    u.verified = r.verified();
    u.permissions = permissions;
    u.updatedAt = Instant.now();
    u.tokenVersion++;
    if (id == null || (r.password() != null && !r.password().isBlank())) {
      check(
        r.password() != null &&
          r.password().length() >= 10 &&
          r
            .password()
            .getBytes(java.nio.charset.StandardCharsets.UTF_8)
            .length <= 72 &&
          r.password().matches(".*[A-Za-z].*") &&
          r.password().matches(".*[0-9].*"),
        "WEAK_PASSWORD",
        "Use 10–72 bytes, letters and a number."
      );
      u.passwordHash = encoder.encode(r.password());
    }
    users.save(u);
    if (
      Set.of("DRIVER", "CONDUCTOR").contains(u.role) &&
      staff.findByUserId(u.id).isEmpty()
    ) {
      var s = new StaffProfile();
      s.user = u;
      staff.save(s);
    }
    return Views.user(u);
  }

  @Transactional
  public Object toggleStatus(Long id) {
    check(current.role("ADMIN") || current.has("USERS"), "FORBIDDEN", "Administrator permission required.");
    mutex.lock();
    check(!id.equals(current.get().id), "SELF_LOCKOUT", "You cannot deactivate your own administrator account.");

    var u = users.lockById(id).orElse(null);
    if (u != null) {
      String nextStatus = "ACTIVE".equalsIgnoreCase(u.status) ? "DISABLED" : "ACTIVE";
      u.status = nextStatus;
      u.tokenVersion++;
      u.updatedAt = Instant.now();
      users.save(u);

      staffMembers.findByEmailIgnoreCase(u.email).ifPresent(s -> {
        s.status = nextStatus;
        if ("DISABLED".equalsIgnoreCase(nextStatus)) s.available = false;
        s.tokenVersion++;
        s.updatedAt = Instant.now();
        staffMembers.save(s);
      });

      staff.findByUserId(u.id).ifPresent(sp -> {
        sp.available = "ACTIVE".equalsIgnoreCase(nextStatus);
        staff.save(sp);
      });

      return map("id", u.id, "email", u.email, "status", u.status, "message", "User account is now " + u.status.toLowerCase());
    }

    var s = staffMembers.lockById(id).orElse(null);
    if (s != null) {
      String nextStatus = "ACTIVE".equalsIgnoreCase(s.status) ? "DISABLED" : "ACTIVE";
      s.status = nextStatus;
      if ("DISABLED".equalsIgnoreCase(nextStatus)) s.available = false;
      s.tokenVersion++;
      s.updatedAt = Instant.now();
      staffMembers.save(s);

      users.findByEmailIgnoreCase(s.email).ifPresent(u2 -> {
        u2.status = nextStatus;
        u2.tokenVersion++;
        u2.updatedAt = Instant.now();
        users.save(u2);
      });

      return map("id", s.id, "email", s.email, "status", s.status, "message", "Staff account is now " + s.status.toLowerCase());
    }

    throw new IllegalArgumentException("User account not found: " + id);
  }

  @Transactional
  public Object delete(Long id) {
    check(current.role("ADMIN") || current.has("USERS"), "FORBIDDEN", "Administrator permission required.");
    mutex.lock();
    check(!id.equals(current.get().id), "SELF_DELETION", "You cannot delete your own administrator account.");

    var uOpt = users.lockById(id);
    if (uOpt.isPresent()) {
      var u = uOpt.get();

      // Check upcoming active trips if driver or conductor
      boolean hasActiveDuty = trips.findAll().stream().anyMatch(t ->
        !Set.of("CANCELLED", "ARRIVED", "COMPLETED").contains(t.status) &&
        t.arrival.isAfter(localNow()) &&
        ((t.driver != null && t.driver.id.equals(u.id)) ||
         (t.conductor != null && t.conductor.id.equals(u.id)))
      );
      check(!hasActiveDuty, "STAFF_ASSIGNED", "Cannot delete an employee with active or upcoming trips. Reassign their duties first.");

      // Clean up trips driver/conductor references
      trips.findAll().stream()
        .filter(t -> (t.driver != null && t.driver.id.equals(u.id)) || (t.conductor != null && t.conductor.id.equals(u.id)))
        .forEach(t -> {
          if (t.driver != null && t.driver.id.equals(u.id)) t.driver = null;
          if (t.conductor != null && t.conductor.id.equals(u.id)) t.conductor = null;
          trips.save(t);
        });

      // Clean up trip tracking driver references
      tripTrackings.findAll().stream()
        .filter(tt -> tt.driver != null && tt.driver.id.equals(u.id))
        .forEach(tt -> {
          tt.driver = null;
          tripTrackings.save(tt);
        });

      // Clear held seats
      tripSeats.findAll().stream()
        .filter(ts -> ts.heldBy != null && ts.heldBy.id.equals(u.id))
        .forEach(ts -> {
          ts.heldBy = null;
          ts.holdToken = null;
          ts.expiresAt = null;
          ts.status = "AVAILABLE";
          tripSeats.save(ts);
        });

      // Clean up notifications
      var notifs = notifications.findByRecipientIdOrderByIdDesc(u.id);
      if (!notifs.isEmpty()) {
        notifications.deleteAll(notifs);
      }

      // Reassign incidents reportedBy to current admin
      incidents.findAll().stream()
        .filter(inc -> inc.reportedBy != null && inc.reportedBy.id.equals(u.id))
        .forEach(inc -> {
          inc.reportedBy = current.get();
          incidents.save(inc);
        });

      // Reassign refunds reviewedBy to current admin
      refunds.findAll().stream()
        .filter(ref -> ref.reviewedBy != null && ref.reviewedBy.id.equals(u.id))
        .forEach(ref -> {
          ref.reviewedBy = current.get();
          refunds.save(ref);
        });

      // Delete support requests
      var reqs = supportRequests.findAll().stream()
        .filter(sr -> sr.passenger != null && sr.passenger.id.equals(u.id))
        .toList();
      if (!reqs.isEmpty()) {
        supportRequests.deleteAll(reqs);
      }

      // Handle user bookings
      var userBookings = bookings.findAll().stream()
        .filter(b -> b.passenger != null && b.passenger.id.equals(u.id))
        .toList();
      for (var b : userBookings) {
        refunds.findAll().stream().filter(r -> r.booking != null && r.booking.id.equals(b.id)).forEach(refunds::delete);
        payments.findAll().stream().filter(p -> p.booking != null && p.booking.id.equals(b.id)).forEach(payments::delete);
        if (b.trip != null && b.seat != null) {
          tripSeats.findByTripIdAndSeatId(b.trip.id, b.seat.id).ifPresent(ts -> {
            ts.status = "AVAILABLE";
            ts.heldBy = null;
            ts.holdToken = null;
            ts.expiresAt = null;
            tripSeats.save(ts);
          });
        }
        bookings.delete(b);
      }

      // Delete staff profile
      staff.findByUserId(u.id).ifPresent(staff::delete);

      // Delete staff member
      staffMembers.findByEmailIgnoreCase(u.email).ifPresent(staffMembers::delete);

      // Finally delete user
      users.delete(u);

      return map("deleted", true, "id", id, "message", "User " + u.email + " removed permanently.");
    }

    var sOpt = staffMembers.lockById(id);
    if (sOpt.isPresent()) {
      var s = sOpt.get();
      users.findByEmailIgnoreCase(s.email).ifPresent(u -> {
        delete(u.id);
      });
      if (staffMembers.existsById(s.id)) {
        staffMembers.delete(s);
      }
      return map("deleted", true, "id", id, "message", "Staff " + s.email + " removed permanently.");
    }

    throw new IllegalArgumentException("User account not found: " + id);
  }

  @Transactional
  public Object profile(Profile r) {
    var u = required(users.lockById(current.get().id), "Account");
    u.firstName = r.firstName().strip();
    u.lastName = r.lastName().strip();
    u.phone = r.phone();
    if (r.email() != null && !r.email().isBlank()) {
      String email = r.email().strip().toLowerCase();
      var duplicate = users.findByEmailIgnoreCase(email);
      check(
        duplicate.isEmpty() || duplicate.get().id.equals(u.id),
        "EMAIL_EXISTS",
        "An account already uses this email."
      );
      u.email = email;
    }
    if (r.password() != null && !r.password().isBlank()) {
      check(
        r.password().length() >= 10 &&
          r.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 72 &&
          r.password().matches(".*[A-Za-z].*") &&
          r.password().matches(".*[0-9].*"),
        "WEAK_PASSWORD",
        "Use 10–72 bytes, letters and a number."
      );
      u.passwordHash = encoder.encode(r.password());
    }
    u.updatedAt = Instant.now();
    return Views.user(u);
  }
}
