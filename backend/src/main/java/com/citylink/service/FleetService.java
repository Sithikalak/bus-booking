package com.citylink.service;

import static com.citylink.util.Values.*;

import com.citylink.dto.Requests.*;
import com.citylink.entity.*;
import com.citylink.mapper.Views;
import com.citylink.repository.*;
import com.citylink.security.CurrentUser;
import java.time.Instant;
import java.util.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FleetService {

  private final BusRepository buses;
  private final SeatRepository seats;
  private final StaffProfileRepository staff;
  private final TripRepository trips;
  private final IncidentRepository incidents;
  private final ResourceMutexRepository mutex;
  private final CurrentUser current;
  private final NotificationService notes;
  private final StaffRepository staffMembers;
  private final UserAccountRepository users;
  private final BCryptPasswordEncoder encoder;

  public FleetService(
    BusRepository buses,
    SeatRepository seats,
    StaffProfileRepository staff,
    TripRepository trips,
    IncidentRepository incidents,
    ResourceMutexRepository mutex,
    CurrentUser current,
    NotificationService notes,
    StaffRepository staffMembers,
    UserAccountRepository users,
    BCryptPasswordEncoder encoder
  ) {
    this.buses = buses;
    this.seats = seats;
    this.staff = staff;
    this.trips = trips;
    this.incidents = incidents;
    this.mutex = mutex;
    this.current = current;
    this.notes = notes;
    this.staffMembers = staffMembers;
    this.users = users;
    this.encoder = encoder;
  }

  @Transactional(readOnly = true)
  public Object buses() {
    check(current.staff(), "FORBIDDEN", "Staff access is required.");
    return buses
      .findAll()
      .stream()
      .map(b -> {
        var v = Views.bus(b);
        var duties = trips
          .findAll()
          .stream()
          .filter(
            t ->
              t.bus != null &&
              t.bus.id.equals(b.id) &&
              !Set.of("CANCELLED", "ARRIVED", "COMPLETED").contains(t.status) &&
              t.arrival.isAfter(localNow())
          )
          .sorted(Comparator.comparing(t -> t.departure))
          .toList();
        Trip nextDuty = duties.isEmpty() ? null : duties.get(0);
        v.put(
          "nextTrip",
          nextDuty == null
            ? null
            : map(
                "id",
                nextDuty.id,
                "departure",
                nextDuty.departure,
                "route",
                nextDuty.route.name,
                "driver",
                nextDuty.driver == null
                  ? null
                  : nextDuty.driver.firstName,
                "conductor",
                nextDuty.conductor == null
                  ? null
                  : nextDuty.conductor.firstName
              )
        );
        v.put(
          "openIncidents",
          incidents.findByBusIdAndStatusNot(b.id, "RESOLVED").size()
        );
        return v;
      })
      .toList();
  }

  @Transactional
  public Object bus(Long id, BusInput r) {
    current.require("FLEET");
    mutex.lock();
    oneOf(
      r.status(),
      "AVAILABLE",
      "ACTIVE",
      "ON_TRIP",
      "MAINTENANCE",
      "OUT_OF_SERVICE"
    );
    var b = id == null ? new Bus() : required(buses.findById(id), "Bus");
    if (id != null) {
      check(
        b.capacity == r.capacity(),
        "SEAT_LAYOUT_FIXED",
        "Capacity is fixed after creation to protect seat references."
      );
      if (Set.of("MAINTENANCE", "OUT_OF_SERVICE").contains(r.status())) check(
        trips
          .findAll()
          .stream()
          .noneMatch(
            t ->
              t.bus != null &&
              t.bus.id.equals(id) &&
              !Set.of("CANCELLED", "ARRIVED", "COMPLETED").contains(t.status) &&
              t.arrival.isAfter(localNow())
          ),
        "BUS_ASSIGNED",
        "Reassign or cancel upcoming trips before making this bus unavailable."
      );
    }
    b.registration = r.registration();
    b.model = r.model();
    b.capacity = r.capacity();
    b.type = r.type();
    b.features = r.features();
    b.status = r.status();
    buses.save(b);
    if (id == null) for (int i = 0; i < b.capacity; i++) {
      var s = new Seat();
      s.bus = b;
      s.rowNumber = i / 4 + 1;
      s.columnNumber = (i % 4) + 1;
      s.number = s.rowNumber + "" + (char) ('A' + (i % 4));
      s.type = s.rowNumber <= 2 ? "PREMIUM" : "STANDARD";
      s.position = i % 4 == 0 || i % 4 == 3 ? "WINDOW" : "AISLE";
      seats.save(s);
    }
    return Views.bus(b);
  }

  @Transactional(readOnly = true)
  public Object staff() {
    var u = current.get();
    check(
      current.has("FLEET") || current.has("SCHEDULES") || current.has("USERS") ||
      (u != null && Set.of("DRIVER", "CONDUCTOR", "OPERATOR", "ADMIN", "CUSTOMER_SERVICE").contains(u.role)),
      "FORBIDDEN",
      "Staff management access is required."
    );
    var allStaff = staffMembers.findAll();
    if (!allStaff.isEmpty()) {
      return allStaff
        .stream()
        .map(s -> {
          var userAccount = users.findByEmailIgnoreCase(s.email).orElse(null);
          var duties = (userAccount == null)
            ? List.of()
            : trips
              .findAll()
              .stream()
              .filter(t ->
                (t.driver != null && t.driver.id.equals(userAccount.id)) ||
                (t.conductor != null && t.conductor.id.equals(userAccount.id))
              )
              .map(t ->
                map(
                  "id", t.id,
                  "route", t.route.name,
                  "departure", t.departure,
                  "arrival", t.arrival,
                  "status", t.status,
                  "acknowledged", s.role.equals("DRIVER") ? t.driverAcknowledged : t.conductorAcknowledged
                )
              )
              .toList();

          return map(
            "id", userAccount != null ? userAccount.id : s.id,
            "staffId", s.id,
            "employeeId", s.employeeId,
            "name", s.firstName + " " + s.lastName,
            "firstName", s.firstName,
            "lastName", s.lastName,
            "email", s.email,
            "phone", s.phone,
            "nic", s.nic,
            "role", s.role,
            "department", s.department,
            "status", s.status,
            "available", s.available,
            "licenseNumber", s.licenseNumber,
            "duties", duties
          );
        })
        .toList();
    }

    return staff
      .findAll()
      .stream()
      .filter(s -> Set.of("DRIVER", "CONDUCTOR").contains(s.user.role))
      .map(s ->
        map(
          "id", s.user.id,
          "employeeId", "EMP-" + s.user.role.substring(0, 3) + "-" + s.user.id,
          "name", s.user.firstName + " " + s.user.lastName,
          "email", s.user.email,
          "phone", s.user.phone,
          "role", s.user.role,
          "status", s.user.status,
          "available", s.available,
          "licenseNumber", s.licenseNumber,
          "duties", trips.findAll().stream()
            .filter(t -> (t.driver != null && t.driver.id.equals(s.user.id)) || (t.conductor != null && t.conductor.id.equals(s.user.id)))
            .map(t -> map(
              "id", t.id,
              "route", t.route.name,
              "departure", t.departure,
              "arrival", t.arrival,
              "status", t.status,
              "acknowledged", s.user.role.equals("DRIVER") ? t.driverAcknowledged : t.conductorAcknowledged
            )).toList()
        )
      )
      .toList();
  }

  @Transactional
  public Object createStaff(Map<String, Object> payload) {
    check(
      current.has("USERS") || current.has("FLEET"),
      "FORBIDDEN",
      "Administrator or Fleet permission is required to register staff."
    );
    String firstName = ((String) payload.getOrDefault("firstName", "")).strip();
    String lastName = ((String) payload.getOrDefault("lastName", "")).strip();
    String email = ((String) payload.getOrDefault("email", "")).toLowerCase().strip();
    String phone = ((String) payload.getOrDefault("phone", "")).strip();
    String nic = ((String) payload.getOrDefault("nic", "")).strip();
    String role = ((String) payload.getOrDefault("role", "DRIVER")).strip().toUpperCase();
    String department = ((String) payload.getOrDefault("department", "Operations")).strip();
    String licenseNumber = (String) payload.get("licenseNumber");
    String password = (String) payload.getOrDefault("password", "CityLink2026!");

    check(!email.isBlank() && !firstName.isBlank() && !lastName.isBlank(), "INVALID_INPUT", "Name and email are required.");
    check(
      staffMembers.findByEmailIgnoreCase(email).isEmpty() && users.findByEmailIgnoreCase(email).isEmpty(),
      "EMAIL_EXISTS",
      "An account already uses this email address."
    );

    String prefix = switch (role) {
      case "ADMIN" -> "EMP-ADM-";
      case "OPERATOR" -> "EMP-OPR-";
      case "DRIVER" -> "EMP-DRV-";
      case "CONDUCTOR" -> "EMP-CND-";
      case "CUSTOMER_SERVICE" -> "EMP-CSS-";
      default -> "EMP-STF-";
    };
    long nextNum = staffMembers.count() + 14;
    String employeeId = prefix + String.format("%03d", nextNum);

    String permissions = switch (role) {
      case "ADMIN" -> "SCHEDULES,FLEET,BOOKINGS,TRACKING,SUPPORT,REPORTS,USERS";
      case "OPERATOR" -> "SCHEDULES,FLEET,BOOKINGS,TRACKING,REPORTS";
      case "CUSTOMER_SERVICE" -> "SUPPORT,BOOKINGS";
      default -> "";
    };

    String hashedPass = encoder.encode(password);

    // Save in Staff entity
    Staff s = new Staff();
    s.employeeId = employeeId;
    s.firstName = firstName;
    s.lastName = lastName;
    s.email = email;
    s.phone = phone;
    s.nic = nic.isBlank() ? "LK-" + System.currentTimeMillis() : nic;
    s.role = role;
    s.department = department;
    s.licenseNumber = licenseNumber != null && !licenseNumber.isBlank() ? licenseNumber.strip() : null;
    s.status = "ACTIVE";
    s.available = true;
    s.passwordHash = hashedPass;
    s.permissions = permissions;
    s.tokenVersion = 0;
    staffMembers.save(s);

    // Also save in UserAccount so trips can assign drivers/conductors
    UserAccount u = new UserAccount();
    u.firstName = firstName;
    u.lastName = lastName;
    u.email = email;
    u.phone = phone;
    u.passwordHash = hashedPass;
    u.role = role;
    u.status = "ACTIVE";
    u.verified = true;
    u.permissions = permissions;
    users.save(u);

    // If driver or conductor, create staff profile as well
    if (Set.of("DRIVER", "CONDUCTOR").contains(role)) {
      StaffProfile sp = new StaffProfile();
      sp.user = u;
      sp.licenseNumber = s.licenseNumber;
      sp.available = true;
      staff.save(sp);
    }

    return map(
      "id", u.id,
      "staffId", s.id,
      "employeeId", s.employeeId,
      "name", s.firstName + " " + s.lastName,
      "email", s.email,
      "phone", s.phone,
      "role", s.role,
      "department", s.department,
      "status", s.status,
      "available", s.available
    );
  }

  @Transactional
  public Object staff(Long id, StaffInput r) {
    var currUser = current.get();
    check(
      current.has("FLEET") || current.has("USERS") ||
      (currUser != null && (currUser.id.equals(id) || staffMembers.findById(id).map(sm -> sm.email.equalsIgnoreCase(currUser.email)).orElse(false))),
      "FORBIDDEN",
      "Fleet management or own profile access is required."
    );
    mutex.lock();
    var sOpt = staff.findByUserId(id);
    if (sOpt.isPresent()) {
      var s = sOpt.get();
      if (r.licenseNumber() != null && !r.licenseNumber().isBlank()) s.licenseNumber = r.licenseNumber().strip();
      s.available = r.available();
      staff.save(s);
    }
    var u = users.findById(id).orElse(null);
    if (u != null) {
      staffMembers.findByEmailIgnoreCase(u.email).ifPresent(sm -> {
        sm.available = r.available();
        if (r.licenseNumber() != null && !r.licenseNumber().isBlank()) sm.licenseNumber = r.licenseNumber().strip();
        staffMembers.save(sm);
      });
    } else {
      staffMembers.findById(id).ifPresent(sm -> {
        sm.available = r.available();
        if (r.licenseNumber() != null && !r.licenseNumber().isBlank()) sm.licenseNumber = r.licenseNumber().strip();
        staffMembers.save(sm);
        users.findByEmailIgnoreCase(sm.email).ifPresent(userAcc -> {
          staff.findByUserId(userAcc.id).ifPresent(sp -> {
            sp.available = r.available();
            staff.save(sp);
          });
        });
      });
    }
    return map("updated", true, "available", r.available());
  }

  @Transactional(readOnly = true)
  public Object incidents() {
    check(current.staff(), "FORBIDDEN", "Staff access is required.");
    var u = current.get();
    return incidents
      .findAll()
      .stream()
      .filter(i -> current.has("FLEET") || i.reportedBy.id.equals(u.id))
      .sorted(Comparator.comparing((Incident i) -> i.id).reversed())
      .map(Views::incident)
      .toList();
  }

  @Transactional
  public Object incident(IncidentInput r) {
    check(current.staff(), "FORBIDDEN", "Staff access is required.");
    oneOf(r.priority(), "LOW", "MEDIUM", "HIGH", "URGENT");
    var b = required(buses.findById(r.busId()), "Bus");
    var i = new Incident();
    i.bus = b;
    i.reportedBy = current.get();
    i.type = r.type();
    i.description = r.description();
    i.priority = r.priority();
    incidents.save(i);
    notes.role(
      "OPERATOR",
      "INCIDENT",
      r.priority() + " vehicle incident",
      b.registration + ": " + r.description()
    );
    notes.role(
      "ADMIN",
      "INCIDENT",
      r.priority() + " vehicle incident",
      b.registration + ": " + r.description()
    );
    return Views.incident(i);
  }

  @Transactional
  public Object incident(Long id, IncidentUpdate r) {
    current.require("FLEET");
    var i = required(incidents.lockById(id), "Incident");
    i.status = oneOf(r.status(), "OPEN", "IN_REVIEW", "RESOLVED");
    i.resolvedAt = i.status.equals("RESOLVED") ? Instant.now() : null;
    notes.send(
      i.reportedBy,
      "INCIDENT",
      "Vehicle issue updated",
      i.bus.registration + ": " + i.status
    );
    return Views.incident(i);
  }
}
