package com.citylink.service;

import static com.citylink.util.Values.*;

import com.citylink.dto.Requests.*;
import com.citylink.entity.*;
import com.citylink.repository.*;
import com.citylink.security.CurrentUser;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TrackingService {

  private final TripRepository trips;
  private final BookingRepository bookings;
  private final GpsSampleRepository samples;
  private final RouteStopRepository stops;
  private final CurrentUser current;
  private final NotificationService notes;
  private final GpsProvider gps;
  private final LockService locks;
  private final ScheduleService schedules;
  private final TripTrackingRepository tripTrackings;
  private final boolean simulation;

  public TrackingService(
    TripRepository trips,
    BookingRepository bookings,
    GpsSampleRepository samples,
    RouteStopRepository stops,
    CurrentUser current,
    NotificationService notes,
    GpsProvider gps,
    LockService locks,
    ScheduleService schedules,
    TripTrackingRepository tripTrackings,
    @Value("${app.tracking-simulation}") boolean simulation
  ) {
    this.trips = trips;
    this.bookings = bookings;
    this.samples = samples;
    this.stops = stops;
    this.current = current;
    this.notes = notes;
    this.gps = gps;
    this.locks = locks;
    this.schedules = schedules;
    this.tripTrackings = tripTrackings;
    this.simulation = simulation;
  }

  private void allowed(Trip t) {
    var u = current.get();
    check(
      current.has("TRACKING") ||
        (t.driver != null && t.driver.id.equals(u.id)) ||
        (t.conductor != null && t.conductor.id.equals(u.id)) ||
        bookings.existsByPassengerIdAndTripIdAndStatus(u.id, t.id, "CONFIRMED"),
      "TRACKING_FORBIDDEN",
      "Track a bus from one of your confirmed bookings."
    );
  }

  public TripTracking getOrCreateTracking(Trip t) {
    var tt = tripTrackings.findByTripId(t.id).orElseGet(() -> {
      var newTt = new TripTracking();
      newTt.trip = t;
      newTt.driver = t.driver;
      newTt.bus = t.bus;
      newTt.status = t.status;
      newTt.isLive = "IN_TRANSIT".equals(t.status);
      newTt.delayMinutes = t.delayMinutes;
      return tripTrackings.save(newTt);
    });

    if (tt.approachingStop == null && t.route != null) {
      var rStops = stops.findByRouteIdOrderByStopOrder(t.route.id);
      if (!rStops.isEmpty()) {
        if ("IN_TRANSIT".equalsIgnoreCase(tt.status) && rStops.size() > 1) {
          tt.approachingStop = rStops.get(1).stop;
        } else {
          tt.approachingStop = rStops.get(0).stop;
        }
        tt = tripTrackings.save(tt);
      }
    }
    return tt;
  }

  @Transactional
  public Object get(Long id) {
    var t = required(trips.findById(id), "Trip");
    allowed(t);
    var sample = samples
      .findFirstByTripIdOrderByRecordedAtDesc(id)
      .orElse(null);
    boolean live =
      t.gpsAvailable &&
      sample != null &&
      sample.recordedAt.isAfter(Instant.now().minusSeconds(60));

    var tt = getOrCreateTracking(t);
    var manifestData = (Map<String, Object>) manifest(id);

    return map(
      "trip",
      schedules.view(t),
      "mode",
      simulation ? "DEVELOPMENT_SIMULATION" : "GPS",
      "gpsStatus",
      live ? "AVAILABLE" : sample == null ? "UNAVAILABLE" : "LAST_KNOWN",
      "isLive",
      tt.isLive,
      "approachingStop",
      tt.approachingStop == null ? null : map(
        "id", tt.approachingStop.id,
        "name", tt.approachingStop.name,
        "latitude", tt.approachingStop.latitude,
        "longitude", tt.approachingStop.longitude
      ),
      "tripTracking",
      map(
        "id", tt.id,
        "tripId", t.id,
        "status", tt.status,
        "isLive", tt.isLive,
        "startedAt", tt.startedAt,
        "endedAt", tt.endedAt,
        "delayMinutes", tt.delayMinutes,
        "approachingStopId", tt.approachingStop != null ? tt.approachingStop.id : null,
        "approachingStopName", tt.approachingStop != null ? tt.approachingStop.name : null,
        "totalPickups", manifestData.get("totalPickups"),
        "totalDropoffs", manifestData.get("totalDropoffs"),
        "updatedAt", tt.updatedAt,
        "telemetry", tt.telemetry == null ? null : map(
          "latitude", tt.telemetry.latitude,
          "longitude", tt.telemetry.longitude,
          "speed", tt.telemetry.speed,
          "progress", tt.telemetry.progress,
          "lastHeartbeat", tt.telemetry.lastHeartbeat
        )
      ),
      "manifest",
      manifestData.get("stops"),
      "position",
      sample == null
        ? null
        : map(
            "latitude",
            sample.latitude,
            "longitude",
            sample.longitude,
            "speed",
            sample.speed,
            "progress",
            sample.progress,
            "recordedAt",
            sample.recordedAt
          ),
      "eta",
      t.arrival.plusMinutes(t.delayMinutes),
      "distanceRemainingKm",
      sample == null
        ? null
        : Math.round(t.route.distanceKm * (1 - sample.progress) * 10) / 10.0,
      "message",
      live
        ? "Location updated"
        : "LIVE LOCATION TEMPORARILY UNAVAILABLE — Showing last known location"
    );
  }

  @Transactional
  public Object startTrip(Long id) {
    var t = locks.trip(id);
    var u = current.get();
    check(
      current.has("TRACKING") || (t.driver != null && t.driver.id.equals(u.id)),
      "FORBIDDEN",
      "Only the assigned driver or operations can start this trip."
    );
    check(!t.status.equals("CANCELLED"), "TRIP_CANCELLED", "Cannot start a cancelled trip.");
    check(!t.status.equals("ARRIVED"), "TRIP_ARRIVED", "Trip has already arrived.");

    t.status = "IN_TRANSIT";
    t.gpsAvailable = true;
    if (t.bus != null) {
      t.bus.status = "ON_TRIP";
    }
    trips.save(t);

    var tt = getOrCreateTracking(t);
    tt.status = "IN_TRANSIT";
    tt.isLive = true;
    tt.startedAt = Instant.now();
    tt.updatedAt = Instant.now();
    if (t.route != null) {
      var rStops = stops.findByRouteIdOrderByStopOrder(t.route.id);
      if (!rStops.isEmpty()) {
        tt.approachingStop = rStops.size() > 1 ? rStops.get(1).stop : rStops.get(0).stop;
      }
    }
    var manifestData = (Map<String, Object>) manifest(id);
    if (manifestData.get("totalPickups") instanceof Number np) {
      tt.totalPickups = np.intValue();
    }
    if (manifestData.get("totalDropoffs") instanceof Number nd) {
      tt.totalDropoffs = nd.intValue();
    }
    if (tt.telemetry == null) {
      tt.telemetry = new TrackingTelemetry();
      tt.telemetry.tracking = tt;
    }
    if (t.route != null) {
      var rStops = stops.findByRouteIdOrderByStopOrder(t.route.id);
      if (!rStops.isEmpty()) {
        tt.telemetry.latitude = rStops.get(0).stop.latitude;
        tt.telemetry.longitude = rStops.get(0).stop.longitude;
      }
    }
    tt.telemetry.progress = 0.0;
    tt.telemetry.speed = 35.0;
    tt.telemetry.lastHeartbeat = Instant.now();
    tripTrackings.save(tt);

    // Notify all passengers who booked this trip that the bus has started!
    for (var b : bookings.findByTripIdAndStatus(t.id, "CONFIRMED")) {
      notes.send(
        b.passenger,
        "TRIP_STARTED",
        "Your bus has departed! 🚌",
        "Bus " + (t.bus != null ? t.bus.registration : "Express") +
        " has started Trip #" + t.id + " (" + t.route.origin + " → " + t.route.destination +
        "). Estimated arrival: " + t.arrival.toLocalTime().withSecond(0) +
        ". Live tracking is now active — track your bus in real time."
      );
    }
    // Notify admin and operator that the trip is in transit
    String startMsg = "Trip #" + t.id + " (" + t.route.origin + " → " + t.route.destination +
      ") has started. Driver: " + (t.driver != null ? t.driver.firstName : "N/A") +
      ". Bus: " + (t.bus != null ? t.bus.registration : "N/A") + ".";
    notes.role("ADMIN", "TRIP_STARTED", "Trip Started: #" + t.id, startMsg);
    notes.role("OPERATOR", "TRIP_STARTED", "Trip Started: #" + t.id, startMsg);

    sample(t);
    return get(id);
  }

  @Transactional
  public Object stopTrip(Long id) {
    var t = locks.trip(id);
    var u = current.get();
    check(
      current.has("TRACKING") || (t.driver != null && t.driver.id.equals(u.id)),
      "FORBIDDEN",
      "Only the assigned driver or operations can stop this trip."
    );

    t.status = "ARRIVED";
    if (t.bus != null) {
      t.bus.status = "AVAILABLE";
    }
    trips.save(t);

    var tt = getOrCreateTracking(t);
    tt.status = "ARRIVED";
    tt.isLive = false;
    tt.endedAt = Instant.now();
    tt.updatedAt = Instant.now();
    if (tt.telemetry != null) {
      tt.telemetry.progress = 1.0;
      tt.telemetry.speed = 0.0;
      tt.telemetry.lastHeartbeat = Instant.now();
    }
    tripTrackings.save(tt);

    // Notify all passengers
    for (var b : bookings.findByTripIdAndStatus(t.id, "CONFIRMED")) {
      notes.send(
        b.passenger,
        "TRIP_COMPLETED",
        "Journey completed ✔️",
        "Trip #" + t.id + " has arrived at " + t.route.destination +
        ". Thank you for riding with CityLink Express. We hope to see you again!"
      );
    }
    // Also notify BOARDED passengers (scanned on board)
    for (var b : bookings.findByTripIdAndStatus(t.id, "BOARDED")) {
      notes.send(
        b.passenger,
        "TRIP_COMPLETED",
        "Journey completed ✔️",
        "Trip #" + t.id + " has arrived at " + t.route.destination +
        ". Thank you for riding with CityLink Express!"
      );
    }
    // Notify admin and operator that the trip is completed
    String arrivedMsg = "Trip #" + t.id + " (" + t.route.origin + " → " + t.route.destination +
      ") has arrived and is completed. Driver: " + (t.driver != null ? t.driver.firstName : "N/A") + ".";
    notes.role("ADMIN", "TRIP_COMPLETED", "Trip Arrived: #" + t.id, arrivedMsg);
    notes.role("OPERATOR", "TRIP_COMPLETED", "Trip Arrived: #" + t.id, arrivedMsg);

    return get(id);
  }

  @Transactional
  public Object updateDelay(Long id, int delayMinutes, String reason) {
    var t = locks.trip(id);
    var u = current.get();
    check(
      current.has("TRACKING") || (t.driver != null && t.driver.id.equals(u.id)),
      "FORBIDDEN",
      "Only the assigned driver or operations can report delays."
    );
    boolean changed = t.delayMinutes != delayMinutes;
    t.delayMinutes = delayMinutes;
    trips.save(t);

    var tt = getOrCreateTracking(t);
    tt.delayMinutes = delayMinutes;
    if (reason != null && !reason.isBlank()) tt.delayReason = reason;
    tt.updatedAt = Instant.now();
    tripTrackings.save(tt);

    if (changed) {
      String delayTitle = delayMinutes > 0
        ? "Bus Delay Notice (+" + delayMinutes + "m)"
        : "✔️ Bus Back On Schedule";
      String delayMsg = "Trip #" + t.id +
        (reason != null && !reason.isBlank() ? " — " + reason + ". " : ". ") +
        (delayMinutes > 0
          ? "New ETA: " + t.arrival.plusMinutes(delayMinutes).toLocalTime().withSecond(0) + "."
          : "Bus is back on its original schedule.");

      for (var b : bookings.findByTripIdAndStatus(t.id, "CONFIRMED")) {
        notes.send(b.passenger, "DELAY", delayTitle, delayMsg);
      }
      // Notify admin and operator about the delay
      String staffDelayMsg = "Trip #" + t.id + " (" + t.route.origin + " → " + t.route.destination + "): " +
        (delayMinutes > 0 ? "+" + delayMinutes + " min delay reported" : "back on schedule") +
        (reason != null && !reason.isBlank() ? " — " + reason : "") + ".";
      notes.role("ADMIN", "DELAY", delayTitle + " — Trip #" + t.id, staffDelayMsg);
      notes.role("OPERATOR", "DELAY", delayTitle + " — Trip #" + t.id, staffDelayMsg);
    }

    return get(id);
  }

  @Transactional
  public Object updateTripStatus(Long id, String status) {
    if ("IN_TRANSIT".equalsIgnoreCase(status)) return startTrip(id);
    if ("ARRIVED".equalsIgnoreCase(status)) return stopTrip(id);

    var t = locks.trip(id);
    var u = current.get();
    check(
      current.has("TRACKING") || (t.driver != null && t.driver.id.equals(u.id)),
      "FORBIDDEN",
      "Only the assigned driver or operations can update status."
    );
    t.status = status;
    trips.save(t);

    var tt = getOrCreateTracking(t);
    tt.status = status;
    tt.isLive = "IN_TRANSIT".equalsIgnoreCase(status);
    tt.updatedAt = Instant.now();
    tripTrackings.save(tt);

    return get(id);
  }

  @Transactional(readOnly = true)
  public Object manifest(Long id) {
    var t = required(trips.findById(id), "Trip");
    var rStops = stops.findByRouteIdOrderByStopOrder(t.route.id);
    var confirmedBookings = bookings.findByTripIdAndStatus(id, "CONFIRMED");

    var manifestList = new ArrayList<Map<String, Object>>();
    int totalPickups = 0;
    int totalDropoffs = 0;

    for (int i = 0; i < rStops.size(); i++) {
      var rs = rStops.get(i);
      var stopName = rs.stop.name;
      boolean isFirst = (i == 0);
      boolean isLast = (i == rStops.size() - 1);

      var pickups = new ArrayList<Map<String, Object>>();
      var dropoffs = new ArrayList<Map<String, Object>>();

      for (var b : confirmedBookings) {
        boolean matchesPickup = false;
        if (b.pickupStop != null && !b.pickupStop.isBlank()) {
          matchesPickup = b.pickupStop.equalsIgnoreCase(stopName) ||
            b.pickupStop.toLowerCase().contains(stopName.toLowerCase()) ||
            stopName.toLowerCase().contains(b.pickupStop.toLowerCase());
        } else if (isFirst) {
          matchesPickup = true;
        }

        boolean matchesDropoff = false;
        if (b.dropoffStop != null && !b.dropoffStop.isBlank()) {
          matchesDropoff = b.dropoffStop.equalsIgnoreCase(stopName) ||
            b.dropoffStop.toLowerCase().contains(stopName.toLowerCase()) ||
            stopName.toLowerCase().contains(b.dropoffStop.toLowerCase());
        } else if (isLast) {
          matchesDropoff = true;
        }

        if (matchesPickup) {
          pickups.add(map(
            "passengerName", b.passengerName,
            "seatNumber", b.seat != null ? b.seat.number : "-",
            "phone", b.passengerPhone,
            "reference", b.reference
          ));
        }

        if (matchesDropoff) {
          dropoffs.add(map(
            "passengerName", b.passengerName,
            "seatNumber", b.seat != null ? b.seat.number : "-",
            "phone", b.passengerPhone,
            "reference", b.reference
          ));
        }
      }

      totalPickups += pickups.size();
      totalDropoffs += dropoffs.size();

      manifestList.add(map(
        "stopId", rs.stop.id,
        "name", stopName,
        "latitude", rs.stop.latitude,
        "longitude", rs.stop.longitude,
        "stopOrder", rs.stopOrder,
        "minutesFromDeparture", rs.minutesFromDeparture,
        "pickups", pickups,
        "dropoffs", dropoffs,
        "pickupCount", pickups.size(),
        "dropoffCount", dropoffs.size()
      ));
    }

    return map(
      "tripId", id,
      "totalBookings", confirmedBookings.size(),
      "totalPickups", totalPickups,
      "totalDropoffs", totalDropoffs,
      "stops", manifestList
    );
  }

  @Transactional
  public Object update(Long id, TrackingInput r) {
    var t = locks.trip(id);
    var u = current.get();
    check(
      current.has("TRACKING") || (t.driver != null && t.driver.id.equals(u.id)),
      "FORBIDDEN",
      "Only the assigned driver or operations can update this trip."
    );
    oneOf(r.status(), "PUBLISHED", "IN_TRANSIT", "ARRIVED");
    check(
      !Set.of("CANCELLED", "DRAFT").contains(t.status),
      "INVALID_TRANSITION",
      "This trip cannot receive live updates."
    );
    check(
      !t.status.equals("ARRIVED") || r.status().equals("ARRIVED"),
      "INVALID_TRANSITION",
      "An arrived trip cannot be restarted."
    );
    check(
      !t.status.equals("IN_TRANSIT") || !r.status().equals("PUBLISHED"),
      "INVALID_TRANSITION",
      "An active trip cannot return to published status."
    );
    boolean delayed = r.delayMinutes() != t.delayMinutes;
    t.status = r.status();
    t.delayMinutes = r.delayMinutes();
    t.gpsAvailable = r.gpsAvailable();
    trips.save(t);

    var tt = getOrCreateTracking(t);
    tt.status = r.status();
    tt.delayMinutes = r.delayMinutes();
    tt.isLive = "IN_TRANSIT".equals(r.status());
    tt.updatedAt = Instant.now();
    tripTrackings.save(tt);

    if (delayed) for (var b : bookings.findByTripIdAndStatus(id, "CONFIRMED"))
      notes.send(
        b.passenger,
        "DELAY",
        r.delayMinutes() > 0
          ? "Your bus is delayed"
          : "Your bus is back on time",
        "Trip #" + id + " ETA: " + t.arrival.plusMinutes(t.delayMinutes) + "."
      );
    sample(t);
    return get(id);
  }

  private void sample(Trip t) {
    if (!simulation) return;
    gps
      .position(t, stops.findByRouteIdOrderByStopOrder(t.route.id))
      .ifPresent(p -> {
        var s = new GpsSample();
        s.trip = t;
        s.latitude = p.latitude();
        s.longitude = p.longitude();
        s.speed = p.speed();
        s.progress = p.progress();
        samples.save(s);

        // Also update TripTracking record
        var tt = getOrCreateTracking(t);
        if (t.route != null) {
          var rStops = stops.findByRouteIdOrderByStopOrder(t.route.id);
          if (!rStops.isEmpty()) {
            int idx = (int) Math.min(rStops.size() - 1, Math.floor(p.progress() * rStops.size()));
            int nextIdx = Math.min(rStops.size() - 1, idx + 1);
            tt.approachingStop = rStops.get(nextIdx).stop;
          }
        }
        if (tt.telemetry == null) {
          tt.telemetry = new com.citylink.entity.TrackingTelemetry();
          tt.telemetry.tracking = tt;
        }
        tt.telemetry.latitude = p.latitude();
        tt.telemetry.longitude = p.longitude();
        tt.telemetry.speed = p.speed();
        tt.telemetry.progress = p.progress();
        tt.telemetry.lastHeartbeat = Instant.now();
        tt.updatedAt = Instant.now();
        tripTrackings.save(tt);

        if (t.status.equals("IN_TRANSIT") && p.progress() < 1) {
          int detected = detectedDelay(
            t.departure,
            t.arrival,
            localNow(),
            p.progress()
          );
          if (Math.abs(detected - t.delayMinutes) >= 5) {
            t.delayMinutes = detected;
            tt.delayMinutes = detected;
            tripTrackings.save(tt);
            for (var b : bookings.findByTripIdAndStatus(t.id, "CONFIRMED"))
              notes.send(
                b.passenger,
                "DELAY",
                detected > 0
                  ? "Your bus is delayed"
                  : "Your bus is back on time",
                "Trip #" +
                  t.id +
                  " ETA: " +
                  t.arrival.plusMinutes(detected) +
                  "."
              );
          }
        }
      });
  }

  @Transactional
  public Object updateTelemetry(Long id, Map<String, Object> payload) {
    var t = locks.trip(id);
    var u = current.get();
    check(
      current.has("TRACKING") || (t.driver != null && t.driver.id.equals(u.id)),
      "FORBIDDEN",
      "Only the assigned driver or operations can update telemetry."
    );

    var tt = getOrCreateTracking(t);
    var rStops = stops.findByRouteIdOrderByStopOrder(t.route.id);

    double progress = 0.0;
    if (payload.containsKey("progress") && payload.get("progress") instanceof Number np) {
      progress = Math.max(0.0, Math.min(1.0, np.doubleValue()));
    }
    double speed = 0.0;
    if (payload.containsKey("speed") && payload.get("speed") instanceof Number ns) {
      speed = ns.doubleValue();
    }
    Double lat = null;
    Double lng = null;
    if (payload.containsKey("latitude") && payload.get("latitude") instanceof Number nlat) {
      lat = nlat.doubleValue();
    }
    if (payload.containsKey("longitude") && payload.get("longitude") instanceof Number nlng) {
      lng = nlng.doubleValue();
    }

    if (payload.containsKey("approachingStopId") && payload.get("approachingStopId") instanceof Number nStopId) {
      Long stopId = nStopId.longValue();
      for (var rs : rStops) {
        if (rs.stop != null && rs.stop.id.equals(stopId)) {
          tt.approachingStop = rs.stop;
          break;
        }
      }
    } else if (!rStops.isEmpty()) {
      int idx = (int) Math.min(rStops.size() - 1, Math.floor(progress * rStops.size()));
      int nextIdx = Math.min(rStops.size() - 1, idx + 1);
      tt.approachingStop = rStops.get(nextIdx).stop;
    }

    if (tt.telemetry == null) {
      tt.telemetry = new TrackingTelemetry();
      tt.telemetry.tracking = tt;
    }
    if (lat != null) tt.telemetry.latitude = lat;
    if (lng != null) tt.telemetry.longitude = lng;
    tt.telemetry.speed = speed;
    tt.telemetry.progress = progress;
    tt.telemetry.lastHeartbeat = Instant.now();
    tt.updatedAt = Instant.now();

    tripTrackings.save(tt);

    if (lat != null && lng != null) {
      var s = new GpsSample();
      s.trip = t;
      s.latitude = lat;
      s.longitude = lng;
      s.speed = speed;
      s.progress = progress;
      samples.save(s);
    }

    return get(id);
  }

  static int detectedDelay(
    LocalDateTime departure,
    LocalDateTime arrival,
    LocalDateTime now,
    double progress
  ) {
    double plannedSeconds = Duration.between(departure, arrival).toSeconds();
    double elapsedSeconds = Duration.between(departure, now).toSeconds();
    return (int) Math.max(
      0,
      Math.min(
        1440,
        Math.round(
          (elapsedSeconds -
            plannedSeconds * Math.max(0, Math.min(1, progress))) /
            60
        )
      )
    );
  }

  @Transactional
  public void tick(Long id) {
    var t = locks.trip(id);
    if (
      Set.of("PUBLISHED", "IN_TRANSIT", "ARRIVED").contains(t.status) &&
      !t.departure.isAfter(localNow().plusHours(24)) &&
      t.arrival.isAfter(localNow().minusHours(2))
    ) sample(t);
  }
}
