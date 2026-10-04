package com.citylink.service;

import static com.citylink.util.Values.*;

import com.citylink.entity.*;
import com.citylink.repository.*;
import com.citylink.security.CurrentUser;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReportService {

  private final TripRepository trips;
  private final BusRepository buses;
  private final BookingRepository bookings;
  private final PaymentRepository payments;
  private final RefundRepository refunds;
  private final SupportRequestRepository requests;
  private final RouteRepository routes;
  private final TripSeatRepository inventory;
  private final CurrentUser current;

  public ReportService(
    TripRepository trips,
    BusRepository buses,
    BookingRepository bookings,
    PaymentRepository payments,
    RefundRepository refunds,
    SupportRequestRepository requests,
    RouteRepository routes,
    TripSeatRepository inventory,
    CurrentUser current
  ) {
    this.trips = trips;
    this.buses = buses;
    this.bookings = bookings;
    this.payments = payments;
    this.refunds = refunds;
    this.requests = requests;
    this.routes = routes;
    this.inventory = inventory;
    this.current = current;
  }

  @Transactional(readOnly = true)
  public Object summary() {
    return map(
      "activeRoutes",
      routes
        .findAll()
        .stream()
        .filter(r -> r.active)
        .count(),
      "fleetSize",
      buses.count(),
      "journeys",
      trips
        .findAll()
        .stream()
        .filter(
          t -> Set.of("PUBLISHED", "CONFIRMED", "BOARDING", "DELAYED").contains(t.status) && t.departure.isAfter(localNow())
        )
        .count(),
      "confirmedBookings",
      bookings
        .findAll()
        .stream()
        .filter(b -> b.status.equals("CONFIRMED"))
        .count()
    );
  }

  @Transactional(readOnly = true)
  public Object dashboard() {
    check(
      current.has("REPORTS") || current.has("SCHEDULES"),
      "FORBIDDEN",
      "Report access is required."
    );
    var today = localNow().toLocalDate();
    var ts = trips.findAll();
    var bs = bookings.findAll();
    var ps = payments.findAll();
    var todayTrips = ts
      .stream()
      .filter(
        t ->
          t.departure.toLocalDate().equals(today) &&
          !Set.of("DRAFT", "CANCELLED").contains(t.status)
      )
      .toList();
    var daily = new ArrayList<Object>();
    for (int i = 6; i >= 0; i--) {
      var date = today.minusDays(i);
      var revenue = ps
        .stream()
        .filter(
          p ->
            p.status.equals("SUCCEEDED") &&
            p.createdAt
              .atZone(ZoneId.of("Asia/Colombo"))
              .toLocalDate()
              .equals(date)
        )
        .map(p -> p.amount)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
      daily.add(
        map(
          "date",
          date,
          "bookings",
          bs
            .stream()
            .filter(
              b ->
                !b.status.equals("FAILED") &&
                b.createdAt
                  .atZone(ZoneId.of("Asia/Colombo"))
                  .toLocalDate()
                  .equals(date)
            )
            .count(),
          "revenue",
          revenue
        )
      );
    }
    var utilization = buses
      .findAll()
      .stream()
      .map(b ->
        map(
          "bus",
          b.registration,
          "trips",
          todayTrips
            .stream()
            .filter(t -> t.bus != null && t.bus.id.equals(b.id))
            .count(),
          "bookedSeats",
          bs
            .stream()
            .filter(
              x ->
                x.trip.bus != null &&
                x.trip.bus.id.equals(b.id) &&
                x.status.equals("CONFIRMED") &&
                x.trip.departure.toLocalDate().equals(today)
            )
            .count()
        )
      )
      .toList();
    return map(
      "todayTrips",
      todayTrips.size(),
      "activeBuses",
      buses
        .findAll()
        .stream()
        .filter(b ->
          Set.of("ACTIVE", "AVAILABLE", "ON_TRIP").contains(b.status)
        )
        .count(),
      "totalBookings",
      bs
        .stream()
        .filter(b -> b.status.equals("CONFIRMED"))
        .count(),
      "availableSeats",
      inventory
        .findAll()
        .stream()
        .filter(
          s ->
            Set.of("PUBLISHED", "CONFIRMED", "BOARDING", "DELAYED").contains(s.trip.status) &&
            s.trip.departure.isAfter(localNow()) &&
            s.seat.enabled &&
            (s.status.equals("AVAILABLE") ||
              (s.status.equals("HELD") && s.expiresAt.isBefore(Instant.now())))
        )
        .count(),
      "delayedTrips",
      todayTrips
        .stream()
        .filter(t -> t.delayMinutes > 0)
        .count(),
      "pendingRequests",
      requests
        .findAll()
        .stream()
        .filter(r -> Set.of("OPEN", "IN_REVIEW").contains(r.status))
        .count() +
        refunds
          .findAll()
          .stream()
          .filter(r -> Set.of("REQUESTED", "FAILED").contains(r.status))
          .count(),
      "revenue",
      ps
        .stream()
        .filter(p -> p.status.equals("SUCCEEDED"))
        .map(p -> p.amount)
        .reduce(BigDecimal.ZERO, BigDecimal::add),
      "daily",
      daily,
      "utilization",
      utilization,
      "tripStatus",
      ts
        .stream()
        .collect(
          java.util.stream.Collectors.groupingBy(
            t -> t.status,
            java.util.stream.Collectors.counting()
          )
        )
    );
  }
}
