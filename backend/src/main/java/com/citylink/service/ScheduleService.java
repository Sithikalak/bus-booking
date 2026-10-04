package com.citylink.service;

import static com.citylink.util.Values.*;

import com.citylink.dto.Requests.*;
import com.citylink.entity.*;
import com.citylink.mapper.Views;
import com.citylink.repository.*;
import com.citylink.security.CurrentUser;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ScheduleService {

  private final TripRepository trips;
  private final RouteRepository routes;
  private final RouteStopRepository routeStops;
  private final StopRepository stops;
  private final BusRepository buses;
  private final UserAccountRepository users;
  private final StaffProfileRepository staff;
  private final StaffRepository staffMembers;
  private final SeatRepository seats;
  private final TripSeatRepository inventory;
  private final BookingRepository bookings;
  private final ResourceMutexRepository mutex;
  private final CurrentUser current;
  private final LockService locks;
  private final NotificationService notes;
  private final BookingService bookingService;
  private final TripTrackingRepository tripTrackings;

  public ScheduleService(
    TripRepository trips,
    RouteRepository routes,
    RouteStopRepository routeStops,
    StopRepository stops,
    BusRepository buses,
    UserAccountRepository users,
    StaffProfileRepository staff,
    StaffRepository staffMembers,
    SeatRepository seats,
    TripSeatRepository inventory,
    BookingRepository bookings,
    ResourceMutexRepository mutex,
    CurrentUser current,
    LockService locks,
    NotificationService notes,
    BookingService bookingService,
    TripTrackingRepository tripTrackings
  ) {
    this.trips = trips;
    this.routes = routes;
    this.routeStops = routeStops;
    this.stops = stops;
    this.buses = buses;
    this.users = users;
    this.staff = staff;
    this.staffMembers = staffMembers;
    this.seats = seats;
    this.inventory = inventory;
    this.bookings = bookings;
    this.mutex = mutex;
    this.current = current;
    this.locks = locks;
    this.notes = notes;
    this.bookingService = bookingService;
    this.tripTrackings = tripTrackings;
  }

  public boolean isStaffOnline(UserAccount u) {
    if (u == null) return false;
    var sp = staff.findByUserId(u.id);
    if (sp.isPresent()) {
      return sp.get().available;
    }
    if (staffMembers != null) {
      var sm = staffMembers.findByEmailIgnoreCase(u.email);
      if (sm.isPresent()) {
        return sm.get().available;
      }
    }
    return u.status != null && u.status.equals("ACTIVE");
  }

  public boolean isCrewOnline(Trip t) {
    // If a driver is assigned, driver must be online
    if (t.driver != null && !isStaffOnline(t.driver)) {
      return false;
    }
    // If a conductor is assigned, conductor must be online
    if (t.conductor != null && !isStaffOnline(t.conductor)) {
      return false;
    }
    return true;
  }

  public Map<String, Object> view(Trip t) {
    int available = (int) inventory
      .findByTripIdOrderById(t.id)
      .stream()
      .filter(
        s ->
          s.seat.enabled &&
          (s.status.equals("AVAILABLE") ||
            (s.status.equals("HELD") && !s.expiresAt.isAfter(Instant.now())))
      )
      .count();
    boolean driverOnline = t.driver != null && isStaffOnline(t.driver);
    boolean conductorOnline = t.conductor != null && isStaffOnline(t.conductor);
    boolean crewOnline = (t.driver == null || driverOnline) && (t.conductor == null || conductorOnline);

    return Views.trip(
      t,
      available,
      routeStops.findByRouteIdOrderByStopOrder(t.route.id),
      driverOnline,
      conductorOnline,
      crewOnline
    );
  }

  @Transactional(readOnly = true)
  public Object routes() {
    return routes
      .findAll()
      .stream()
      .map(r -> Views.route(r, routeStops.findByRouteIdOrderByStopOrder(r.id)))
      .toList();
  }

  private boolean matchesRoute(Trip t, String orig, String dest) {
    if (orig.isBlank() && dest.isBlank()) return true;

    String rOrig = t.route.origin == null ? "" : t.route.origin.trim().toLowerCase();
    String rDest = t.route.destination == null ? "" : t.route.destination.trim().toLowerCase();

    boolean directOrig = !orig.isBlank() && (rOrig.contains(orig) || orig.contains(rOrig));
    boolean directDest = !dest.isBlank() && (rDest.contains(dest) || dest.contains(rDest));

    if (!orig.isBlank() && !dest.isBlank() && directOrig && directDest) {
      return true;
    }

    var stopsList = routeStops.findByRouteIdOrderByStopOrder(t.route.id);
    int origPos = -1;
    int destPos = -1;

    if (directOrig) {
      origPos = 0;
    }

    for (int i = 0; i < stopsList.size(); i++) {
      String stopName = stopsList.get(i).stop.name.trim().toLowerCase();
      if (origPos == -1 && !orig.isBlank() && (stopName.contains(orig) || orig.contains(stopName))) {
        origPos = i;
      }
      if (!dest.isBlank() && (stopName.contains(dest) || dest.contains(stopName))) {
        destPos = i;
      }
    }

    if (directDest) {
      destPos = Math.max(destPos, stopsList.isEmpty() ? 1 : stopsList.size());
    }

    if (!orig.isBlank() && origPos == -1) return false;
    if (!dest.isBlank() && destPos == -1) return false;

    if (origPos != -1 && destPos != -1 && origPos >= destPos) {
      return false;
    }

    return true;
  }

  @Transactional(readOnly = true)
  public Object search(
    String origin,
    String destination,
    LocalDate date,
    LocalTime time,
    int page,
    int size
  ) {
    String orig = origin == null ? "" : origin.strip().toLowerCase();
    String dest = destination == null ? "" : destination.strip().toLowerCase();

    return page(
      trips
        .findAll()
        .stream()
        .filter(
          t ->
            Set.of("PUBLISHED", "CONFIRMED", "BOARDING", "DELAYED").contains(t.status) &&
            t.departure.isAfter(localNow()) &&
            t.route.active &&
            isCrewOnline(t)
        )
        .filter(t -> matchesRoute(t, orig, dest))
        .filter(t -> date == null || t.departure.toLocalDate().equals(date))
        .filter(t -> time == null || !t.departure.toLocalTime().isBefore(time))
        .sorted(Comparator.comparing(t -> t.departure))
        .map(this::view)
        .toList(),
      page,
      size
    );
  }

  @Transactional(readOnly = true)
  public Object get(Long id) {
    var t = required(trips.findById(id), "Trip");
    if (t.status.equals("DRAFT")) current.require("SCHEDULES");
    return view(t);
  }

  @Transactional(readOnly = true)
  public Object list(int page, int size) {
    var u = current.get();
    check(
      current.has("SCHEDULES") ||
        current.has("TRACKING") ||
        current.has("FLEET") ||
        Set.of("DRIVER", "CONDUCTOR").contains(u.role),
      "FORBIDDEN",
      "You cannot view staff schedules."
    );
    return page(
      trips
        .findAll()
        .stream()
        .filter(
          t ->
            !Set.of("DRIVER", "CONDUCTOR").contains(u.role) ||
            (t.driver != null && t.driver.id.equals(u.id)) ||
            (t.conductor != null && t.conductor.id.equals(u.id))
        )
        .sorted(Comparator.comparing(t -> t.departure))
        .map(this::view)
        .toList(),
      page,
      size
    );
  }

  @Transactional
  public Object route(Long id, RouteInput r) {
    current.require("SCHEDULES");
    mutex.lock();
    check(
      !r.origin().equalsIgnoreCase(r.destination()),
      "INVALID_ROUTE",
      "Origin and destination must be different."
    );
    check(
      r.stops().get(0).minutesFromDeparture() == 0,
      "INVALID_STOPS",
      "The first stop must start at minute zero."
    );
    check(
      r.stops().get(0).name().equalsIgnoreCase(r.origin()) &&
        r.stops().get(r.stops().size() - 1).name().equalsIgnoreCase(r.destination()),
      "INVALID_STOPS",
      "The first and last stops must match the origin and destination."
    );
    for (int i = 1; i < r.stops().size(); i++) check(
      r.stops().get(i).minutesFromDeparture() >
        r
          .stops()
          .get(i - 1)
          .minutesFromDeparture(),
      "INVALID_STOPS",
      "Stop times must increase along the route."
    );
    if (id != null) check(
      trips
        .findAll()
        .stream()
        .noneMatch(t -> t.route.id.equals(id) && !t.status.equals("CANCELLED")),
      "ROUTE_IN_USE",
      "Create a new route version when existing trips use this route."
    );
    var route =
      id == null ? new Route() : required(routes.findById(id), "Route");
    route.name = r.name();
    route.origin = r.origin();
    route.destination = r.destination();
    route.distanceKm = r.distanceKm();
    route.active = r.active();
    route.imageUrl = r.imageUrl();
    routes.save(route);
    if (id != null) {
      routeStops.deleteByRouteId(id);
      routeStops.flush();
    }
    int order = 0;
    for (var input : r.stops()) {
      var s = new Stop();
      s.name = input.name();
      s.latitude = input.latitude();
      s.longitude = input.longitude();
      stops.save(s);
      var rs = new RouteStop();
      rs.route = route;
      rs.stop = s;
      rs.stopOrder = order++;
      rs.minutesFromDeparture = input.minutesFromDeparture();
      routeStops.save(rs);
    }
    return Views.route(
      route,
      routeStops.findByRouteIdOrderByStopOrder(route.id)
    );
  }

  private UserAccount resource(Long id, String role) {
    if (id == null) return null;
    var u = required(users.findById(id), role);
    check(
      u.role.equals(role) && u.status.equals("ACTIVE") && u.verified,
      "INVALID_RESOURCE",
      "Selected " +
        role.toLowerCase() +
        " is not an active, verified staff member."
    );
    check(
      staff
        .findByUserId(id)
        .map(s -> s.available)
        .orElse(false),
      "RESOURCE_UNAVAILABLE",
      u.firstName +
        " is unavailable. Select another " +
        role.toLowerCase() +
        "."
    );
    return u;
  }

  private boolean same(Object a, Object b) {
    return Objects.equals(a, b);
  }

  @Transactional
  public Object save(Long id, ScheduleInput r) {
    current.require("SCHEDULES");
    mutex.lock();
    var t = id == null ? new Trip() : locks.trip(id);
    oneOf(r.status(), "DRAFT", "PUBLISHED");
    check(
      id == null || Set.of("DRAFT", "PUBLISHED").contains(t.status),
      "INVALID_TRANSITION",
      "Only draft or published trips can be edited."
    );
    check(
      r.departure().isAfter(localNow()) && r.arrival().isAfter(r.departure()),
      "INVALID_TIMETABLE",
      "Choose a future departure and an arrival after departure."
    );
    var route = required(routes.findById(r.routeId()), "Route");
    check(route.active, "ROUTE_INACTIVE", "Select an active route.");
    var rs = routeStops.findByRouteIdOrderByStopOrder(route.id);
    check(
      rs.size() >= 2,
      "MISSING_STOPS",
      "Add origin and destination stops first."
    );
    check(
      Duration.between(r.departure(), r.arrival()).toMinutes() ==
        rs.get(rs.size() - 1).minutesFromDeparture,
      "INVALID_ARRIVAL",
      "Arrival must match the final route stop: " +
        r.departure().plusMinutes(rs.get(rs.size() - 1).minutesFromDeparture) +
        "."
    );
    var bus =
      r.busId() == null ? null : required(buses.findById(r.busId()), "Bus");
    if (bus != null) check(
      Set.of("AVAILABLE", "ACTIVE", "ON_TRIP").contains(bus.status),
      "BUS_UNAVAILABLE",
      bus.registration + " is unavailable (" + bus.status + ")."
    );
    var driver = resource(r.driverId(), "DRIVER");
    var conductor = resource(r.conductorId(), "CONDUCTOR");
    if (r.status().equals("PUBLISHED")) check(
      bus != null && driver != null && conductor != null,
      "MISSING_RESOURCES",
      "Assign a bus, driver and conductor before publishing."
    );
    for (var other : trips.overlapping(r.departure(), r.arrival(), id)) {
      String conflict = null;
      if (
        bus != null && other.bus != null && bus.id.equals(other.bus.id)
      ) conflict = "Bus " + bus.registration;
      if (
        driver != null &&
        other.driver != null &&
        driver.id.equals(other.driver.id)
      ) conflict = "Driver " + driver.firstName;
      if (
        conductor != null &&
        other.conductor != null &&
        conductor.id.equals(other.conductor.id)
      ) conflict = "Conductor " + conductor.firstName;
      check(
        conflict == null,
        "SCHEDULE_CONFLICT",
        conflict +
          " is already assigned to trip #" +
          other.id +
          " between " +
          other.departure +
          " and " +
          other.arrival +
          ". Choose another resource or timetable."
      );
    }
    var active =
      id == null
        ? List.<Booking>of()
        : bookings.findByTripIdAndStatus(id, "CONFIRMED");
    var oldBus = t.bus == null ? null : t.bus.id;
    var oldDriver = t.driver == null ? null : t.driver.id;
    var oldConductor = t.conductor == null ? null : t.conductor.id;
    if (!active.isEmpty()) {
      check(
        r.confirmChanges(),
        "CONFIRM_CHANGES",
        active.size() +
          " confirmed booking(s) will be affected. Confirm this change to notify passengers."
      );
      check(
        same(oldBus, r.busId()) &&
          t.route.id.equals(r.routeId()) &&
          r.status().equals("PUBLISHED"),
        "BOOKED_TRIP_STRUCTURE",
        "A booked trip must retain its bus, route and published status. Cancel it and create a replacement to change these."
      );
    }
    if (id != null) {
      for (var s : inventory.findByTripIdOrderById(id))
        if (s.status.equals("HELD")) {
          notes.send(
            s.heldBy,
            "SCHEDULE",
            "Checkout cancelled",
            "Your trip schedule changed. Please select a seat again."
          );
          bookingService.clear(s);
        }
      if (!same(oldBus, r.busId())) {
        inventory.deleteByTripId(id);
        inventory.flush();
      }
    }
    t.route = route;
    t.bus = bus;
    t.driver = driver;
    t.conductor = conductor;
    t.departure = r.departure();
    t.arrival = r.arrival();
    t.fare = r.fare();
    t.status = r.status();
    if (!same(oldDriver, r.driverId())) t.driverAcknowledged = false;
    if (!same(oldConductor, r.conductorId())) t.conductorAcknowledged = false;
    trips.save(t);
    if (
      bus != null && (id == null || !same(oldBus, r.busId()))
    ) for (var seat : seats.findByBusIdOrderByRowNumberAscColumnNumberAsc(
      bus.id
    )) {
      var i = new TripSeat();
      i.trip = t;
      i.seat = seat;
      inventory.save(i);
    }
    // Notify driver with full trip details
    if (driver != null) notes.send(
      driver,
      "ASSIGNMENT",
      "New Trip Assignment — Trip #" + t.id,
      "You have been assigned to drive Trip #" + t.id + ": " + t.route.origin + " → " + t.route.destination +
      " on " + t.departure.toLocalDate() + " at " + t.departure.toLocalTime().withSecond(0).withNano(0) +
      ". Bus: " + (bus != null ? bus.registration : "TBA") + ". Please confirm your duty in the Driver Portal."
    );
    // Notify conductor with full trip details
    if (conductor != null) notes.send(
      conductor,
      "ASSIGNMENT",
      "New Trip Assignment — Trip #" + t.id,
      "You have been assigned as conductor for Trip #" + t.id + ": " + t.route.origin + " → " + t.route.destination +
      " on " + t.departure.toLocalDate() + " at " + t.departure.toLocalTime().withSecond(0).withNano(0) +
      ". Bus: " + (bus != null ? bus.registration : "TBA") + ". Please confirm your duty in the Conductor Portal."
    );
    active.forEach(b ->
      notes.send(
        b.passenger,
        "SCHEDULE",
        "Your schedule changed",
        b.reference +
          " now departs " +
          t.departure +
          " and arrives " +
          t.arrival +
          "."
      )
    );
    return view(t);
  }

  @Transactional
  public Object cancel(Long id, boolean confirmed) {
    current.require("SCHEDULES");
    mutex.lock();
    var t = locks.trip(id);
    check(
      !t.status.equals("ARRIVED"),
      "INVALID_TRANSITION",
      "An arrived trip cannot be cancelled."
    );
    if (t.status.equals("CANCELLED")) return view(t);
    var active = bookings.findByTripIdAndStatus(id, "CONFIRMED");
    check(
      active.isEmpty() || confirmed,
      "CONFIRM_CHANGES",
      active.size() +
        " booking(s) will be affected. Confirm cancellation to notify passengers."
    );
    t.status = "CANCELLED";
    if (t.bus != null && "ON_TRIP".equals(t.bus.status)) {
      t.bus.status = "AVAILABLE";
      buses.save(t.bus);
    }
    for (var s : inventory.findByTripIdOrderById(id))
      if (s.status.equals("HELD")) {
        notes.send(
          s.heldBy,
          "CANCELLATION",
          "Trip cancelled",
          "Your seat hold ended because the trip was cancelled."
        );
        bookingService.clear(s);
      }
    active.forEach(b ->
      notes.send(
        b.passenger,
        "CANCELLATION",
        "Your trip was cancelled",
        b.reference + ": request a full refund from My journeys."
      )
    );
    if (t.driver != null) notes.send(
      t.driver,
      "CANCELLATION",
      "Duty cancelled",
      "Trip #" + t.id + " was cancelled."
    );
    if (t.conductor != null) notes.send(
      t.conductor,
      "CANCELLATION",
      "Duty cancelled",
      "Trip #" + t.id + " was cancelled."
    );
    return view(t);
  }

  @Transactional
  public Object acknowledge(Long id) {
    var t = locks.trip(id);
    var u = current.get();
    check(
      (t.driver != null && t.driver.id.equals(u.id)) ||
        (t.conductor != null && t.conductor.id.equals(u.id)),
      "FORBIDDEN",
      "Only assigned staff can acknowledge this trip."
    );
    if (t.driver != null && t.driver.id.equals(u.id)) t.driverAcknowledged = true;
    if (t.conductor != null && t.conductor.id.equals(u.id)) t.conductorAcknowledged = true;
    if (Boolean.TRUE.equals(t.driverAcknowledged)) {
      t.status = "CONFIRMED";
    }
    trips.save(t);

    String roleTitle = "DRIVER".equals(u.role) ? "Driver" : "Conductor";
    String staffName = u.firstName + (u.lastName != null ? " " + u.lastName : "");
    String notifMsg = roleTitle + " " + staffName +
      " confirmed assignment for Trip #" + t.id +
      " (" + t.route.origin + " → " + t.route.destination +
      ", departs " + t.departure.toLocalDate() + " at " + t.departure.toLocalTime().withSecond(0).withNano(0) + ")";
    notes.role("ADMIN", "ASSIGNMENT_CONFIRMED", roleTitle + " Confirmed: Trip #" + t.id, notifMsg);
    notes.role("OPERATOR", "ASSIGNMENT_CONFIRMED", roleTitle + " Confirmed: Trip #" + t.id, notifMsg);

    return view(t);
  }

  @Transactional
  public Object deleteTrip(Long id) {
    var t = locks.trip(id);
    var u = current.get();
    check(
      current.has("SCHEDULES") || (t.driver != null && t.driver.id.equals(u.id)),
      "FORBIDDEN",
      "Operations or assigned driver access required to delete trip."
    );
    var activeBookings = bookings.findByTripIdAndStatus(id, "CONFIRMED");
    check(
      activeBookings.isEmpty(),
      "TRIP_HAS_BOOKINGS",
      "Cannot delete trip #" + id + " because it has " + activeBookings.size() + " active passenger booking(s). Cancel the trip instead."
    );
    inventory.deleteByTripId(id);
    tripTrackings.findByTripId(id).ifPresent(tripTrackings::delete);
    trips.delete(t);
    return map("success", true, "message", "Trip #" + id + " deleted successfully.");
  }

  @Transactional(readOnly = true)
  public Object availability(
    LocalDateTime departure,
    LocalDateTime arrival,
    Long exclude
  ) {
    check(
      current.has("SCHEDULES") || current.has("FLEET"),
      "FORBIDDEN",
      "Resource access is required."
    );
    check(
      arrival.isAfter(departure),
      "INVALID_TIMETABLE",
      "Arrival must be after departure."
    );
    var overlaps = trips.overlapping(departure, arrival, exclude);
    return map(
      "buses",
      buses
        .findAll()
        .stream()
        .filter(
          b ->
            Set.of("AVAILABLE", "ACTIVE", "ON_TRIP").contains(b.status) &&
            overlaps
              .stream()
              .noneMatch(t -> t.bus != null && t.bus.id.equals(b.id))
        )
        .map(Views::bus)
        .toList(),
      "staff",
      staff
        .findAll()
        .stream()
        .filter(
          s ->
            s.available &&
            s.user.status.equals("ACTIVE") &&
            Set.of("DRIVER", "CONDUCTOR").contains(s.user.role) &&
            overlaps
              .stream()
              .noneMatch(
                t ->
                  (t.driver != null && t.driver.id.equals(s.user.id)) ||
                  (t.conductor != null && t.conductor.id.equals(s.user.id))
              )
        )
        .map(s -> Views.user(s.user))
        .toList()
    );
  }

  public Map<String, Object> uploadRouteImage(org.springframework.web.multipart.MultipartFile file) {
    current.require("SCHEDULES");
    check(file != null && !file.isEmpty(), "INVALID_FILE", "Please choose an image file.");
    try {
      String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "image.jpg";
      String ext = originalFilename.contains(".") ? originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase() : ".jpg";

      java.nio.file.Path routesDir = java.nio.file.Paths.get("frontend", "public", "images", "routes");
      if (!java.nio.file.Files.exists(routesDir)) {
        routesDir = java.nio.file.Paths.get("..", "frontend", "public", "images", "routes");
      }
      java.nio.file.Files.createDirectories(routesDir);

      String baseName = "route-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8);
      java.nio.file.Path webpPath = routesDir.resolve(baseName + ".webp");

      java.nio.file.Path tempFile = java.nio.file.Files.createTempFile("route-upload-", ext);
      file.transferTo(tempFile.toFile());

      boolean converted = false;
      if (ext.equals(".webp")) {
        java.nio.file.Files.copy(tempFile, webpPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        converted = true;
      } else {
        try {
          ProcessBuilder pb = new ProcessBuilder(
            "python", "-c",
            "from PIL import Image; img=Image.open(r'" + tempFile.toString() + "'); " +
            "if img.mode != 'RGB': img=img.convert('RGB'); " +
            "max_dim = 1920; " +
            "if img.width > max_dim or img.height > max_dim: img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS); " +
            "img.save(r'" + webpPath.toString() + "', 'WEBP', quality=90, method=6)"
          );
          Process process = pb.start();
          int exitCode = process.waitFor();
          converted = (exitCode == 0 && java.nio.file.Files.exists(webpPath));
        } catch (Exception ex) {
          // fallback
        }
      }

      if (!converted) {
        java.nio.file.Files.copy(tempFile, webpPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
      }
      java.nio.file.Files.deleteIfExists(tempFile);

      String publicUrl = "/images/routes/" + baseName + ".webp";
      return Map.of("url", publicUrl, "filename", baseName + ".webp", "size", java.nio.file.Files.size(webpPath));
    } catch (Exception e) {
      throw new com.citylink.exception.BusinessException("UPLOAD_FAILED", "Failed to upload and optimize route image: " + e.getMessage());
    }
  }

  public Map<String, Object> uploadRouteImageData(String base64Data, String preferredName) {
    current.require("SCHEDULES");
    check(base64Data != null && !base64Data.isBlank(), "INVALID_DATA", "No image data provided.");
    try {
      String cleanData = base64Data;
      if (cleanData.contains(",")) {
        cleanData = cleanData.substring(cleanData.indexOf(",") + 1);
      }
      byte[] decoded = Base64.getDecoder().decode(cleanData);

      java.nio.file.Path routesDir = java.nio.file.Paths.get("frontend", "public", "images", "routes");
      if (!java.nio.file.Files.exists(routesDir)) {
        routesDir = java.nio.file.Paths.get("..", "frontend", "public", "images", "routes");
      }
      java.nio.file.Files.createDirectories(routesDir);

      String baseName = "route-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8);
      java.nio.file.Path webpPath = routesDir.resolve(baseName + ".webp");

      java.nio.file.Files.write(webpPath, decoded);

      String publicUrl = "/images/routes/" + baseName + ".webp";
      return Map.of("url", publicUrl, "filename", baseName + ".webp", "size", java.nio.file.Files.size(webpPath));
    } catch (Exception e) {
      throw new com.citylink.exception.BusinessException("UPLOAD_FAILED", "Failed to save route image: " + e.getMessage());
    }
  }
}
