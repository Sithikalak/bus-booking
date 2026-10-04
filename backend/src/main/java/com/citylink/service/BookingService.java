package com.citylink.service;

import static com.citylink.util.Values.*;

import com.citylink.dto.Requests.*;
import com.citylink.entity.*;
import com.citylink.exception.BusinessException;
import com.citylink.mapper.Views;
import com.citylink.repository.*;
import com.citylink.security.CurrentUser;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookingService {

  private final TripSeatRepository inventory;
  private final BookingRepository bookings;
  private final PaymentRepository payments;
  private final CurrentUser current;
  private final LockService locks;
  private final PaymentGateway gateway;
  private final NotificationService notes;

  public BookingService(
    TripSeatRepository inventory,
    BookingRepository bookings,
    PaymentRepository payments,
    CurrentUser current,
    LockService locks,
    PaymentGateway gateway,
    NotificationService notes
  ) {
    this.inventory = inventory;
    this.bookings = bookings;
    this.payments = payments;
    this.current = current;
    this.locks = locks;
    this.gateway = gateway;
    this.notes = notes;
  }

  public void clear(TripSeat s) {
    s.status = "AVAILABLE";
    s.heldBy = null;
    s.expiresAt = null;
    s.holdToken = null;
  }

  public void expire(List<TripSeat> seats) {
    var now = Instant.now();
    for (var s : seats)
      if (s.status.equals("HELD") && !s.expiresAt.isAfter(now)) {
        notes.send(
          s.heldBy,
          "HOLD_EXPIRED",
          "Your seat hold expired",
          "Seat " +
            s.seat.number +
            " is available again. Select a seat to continue."
        );
        clear(s);
      }
  }

  @Transactional
  public void expireTrip(Long id) {
    locks.trip(id);
    expire(inventory.findByTripIdOrderById(id));
  }

  @Transactional
  public Object seats(Long id) {
    var t = locks.trip(id);
    check(
      !t.status.equals("DRAFT"),
      "TRIP_UNAVAILABLE",
      "This trip is not published."
    );
    var list = inventory.findByTripIdOrderById(id);
    expire(list);
    return map(
      "seats",
      list.stream().map(Views::seat).toList(),
      "serverTime",
      Instant.now()
    );
  }

  @Transactional
  public Object hold(Long tripId, Long seatId) {
    check(
      current.role("PASSENGER"),
      "PASSENGER_REQUIRED",
      "Use a passenger account to book a ticket."
    );
    var u = current.get();
    var t = locks.trip(tripId);
    check(
      Set.of("PUBLISHED", "CONFIRMED", "BOARDING", "DELAYED").contains(t.status) && t.departure.isAfter(localNow()),
      "TRIP_UNAVAILABLE",
      "This trip is no longer available for booking."
    );
    var list = inventory.findByTripIdOrderById(tripId);
    expire(list);
    var s = required(
      list
        .stream()
        .filter(x -> x.seat.id.equals(seatId))
        .findFirst(),
      "Seat"
    );
    check(s.seat.enabled, "SEAT_DISABLED", "This seat is unavailable.");
    if (s.status.equals("HELD") && s.heldBy.id.equals(u.id)) return holdView(s);
    check(
      s.status.equals("AVAILABLE"),
      "SEAT_UNAVAILABLE",
      "This seat is no longer available. Please choose another."
    );
    s.status = "HELD";
    s.heldBy = u;
    s.holdToken = UUID.randomUUID().toString();
    s.expiresAt = Instant.now().plusSeconds(600);
    return holdView(s);
  }

  private Object holdView(TripSeat s) {
    return map(
      "inventoryId",
      s.id,
      "tripId",
      s.trip.id,
      "seatId",
      s.seat.id,
      "seatNumber",
      s.seat.number,
      "holdToken",
      s.holdToken,
      "expiresAt",
      s.expiresAt,
      "serverTime",
      Instant.now(),
      "fare",
      s.trip.fare
    );
  }

  private TripSeat lockHold(String token) {
    var s = required(inventory.findByHoldToken(token), "Seat hold");
    locks.trip(s.trip.id);
    locks.refresh(s);
    check(
      token.equals(s.holdToken),
      "HOLD_EXPIRED",
      "This hold has ended. Please select a seat again."
    );
    current.owner(s.heldBy.id);
    return s;
  }

  @Transactional(noRollbackFor = BusinessException.class)
  public Object getHold(String token) {
    var s = lockHold(token);
    expire(List.of(s));
    check(
      s.status.equals("HELD"),
      "HOLD_EXPIRED",
      "Your seat hold expired. Please select a seat again."
    );
    return holdView(s);
  }

  @Transactional
  public Object release(String token) {
    var found = inventory.findByHoldToken(token);
    if (found.isEmpty()) return map("released", true);
    var s = lockHold(token);
    clear(s);
    return map("released", true);
  }

  private Object paymentResult(Payment p) {
    return paymentResult(p, null);
  }

  private Object paymentResult(Payment p, String allSeats) {
    var view = p.status.equals("SUCCEEDED") ? Views.booking(p.booking, p) : null;
    if (view != null && allSeats != null && !allSeats.isBlank()) {
      var mod = new java.util.LinkedHashMap<>(view);
      mod.put("seat", allSeats);
      mod.put("seats", allSeats);
      view = mod;
    }
    return map(
      "status",
      p.status,
      "booking",
      view,
      "message",
      p.status.equals("SUCCEEDED")
        ? "Your journey is confirmed."
        : "Payment declined. Your seat remains held until the original checkout deadline."
    );
  }

  private Object existing(Payment p, Checkout r) {
    current.owner(p.booking.passenger.id);
    check(
      p.method.equals(r.method()) &&
        p.booking.passengerName.equals(r.passengerName()) &&
        p.booking.passengerPhone.equals(r.passengerPhone()),
      "IDEMPOTENCY_CONFLICT",
      "This payment key was used for different details."
    );
    return paymentResult(p);
  }

  @Transactional(noRollbackFor = BusinessException.class)
  public Object checkout(Checkout r) {
    check(
      current.role("PASSENGER"),
      "PASSENGER_REQUIRED",
      "Use a passenger account to book."
    );
    oneOf(r.method(), "CARD", "MOCK_ONLINE");
    oneOf(r.paymentToken(), "mock_success", "mock_decline", "mock_refund_fail");
    var existing = payments.findByIdempotencyKey(r.idempotencyKey());
    if (existing.isPresent()) return existing(existing.get(), r);
    List<String> tokens = new java.util.ArrayList<>();
    if (r.holdTokens() != null && !r.holdTokens().isEmpty()) {
      tokens.addAll(r.holdTokens().stream().filter(t -> t != null && !t.isBlank()).toList());
    } else if (r.holdToken() != null && !r.holdToken().isBlank()) {
      tokens.add(r.holdToken());
    }
    check(!tokens.isEmpty(), "HOLD_REQUIRED", "No seat holds found for checkout.");

    List<TripSeat> heldSeats = new java.util.ArrayList<>();
    for (String token : tokens) {
      var s = lockHold(token);
      existing = payments.findByIdempotencyKey(r.idempotencyKey());
      if (existing.isPresent()) return existing(existing.get(), r);
      expire(List.of(s));
      check(
        s.status.equals("HELD"),
        "HOLD_EXPIRED",
        "Your seat hold expired. Please select a seat again."
      );
      check(
        Set.of("PUBLISHED", "CONFIRMED", "BOARDING", "DELAYED").contains(s.trip.status) && s.trip.departure.isAfter(localNow()),
        "TRIP_UNAVAILABLE",
        "This trip cannot accept bookings."
      );
      heldSeats.add(s);
    }

    var singleSeatFare = (r.fare() != null && r.fare().compareTo(java.math.BigDecimal.ZERO) > 0)
      ? r.fare()
      : heldSeats.get(0).trip.fare;
    var totalCharge = singleSeatFare.multiply(java.math.BigDecimal.valueOf(heldSeats.size()));

    var result = gateway.charge(
      r.paymentToken(),
      totalCharge,
      r.idempotencyKey()
    );

    String groupRef = "CLX-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase();
    String allSeatNumbers = heldSeats.stream().map(hs -> hs.seat.number).collect(java.util.stream.Collectors.joining(", "));

    Booking primaryBooking = null;
    for (int i = 0; i < heldSeats.size(); i++) {
      var s = heldSeats.get(i);
      var b = new Booking();
      b.passenger = current.get();
      b.trip = s.trip;
      b.seat = s.seat;
      b.passengerName = r.passengerName();
      b.passengerPhone = r.passengerPhone();
      b.pickupStop = (r.pickupStop() != null && !r.pickupStop().isBlank())
        ? r.pickupStop()
        : s.trip.route.origin;
      b.dropoffStop = (r.dropoffStop() != null && !r.dropoffStop().isBlank())
        ? r.dropoffStop()
        : s.trip.route.destination;
      b.reference = (heldSeats.size() == 1) ? groupRef : groupRef + "-" + (i + 1);
      b.status = result.success() ? "CONFIRMED" : "FAILED";
      b.totalAmount = singleSeatFare;
      bookings.save(b);
      if (primaryBooking == null) {
        primaryBooking = b;
      }
    }

    var p = new Payment();
    p.booking = primaryBooking;
    p.amount = totalCharge;
    p.method = r.method();
    p.status = result.success() ? "SUCCEEDED" : "FAILED";
    p.transactionReference = result.reference();
    p.idempotencyKey = r.idempotencyKey();
    p.refundFailure = r.paymentToken().equals("mock_refund_fail");
    payments.save(p);

    if (result.success()) {
      for (var s : heldSeats) {
        s.status = "BOOKED";
        s.heldBy = null;
        s.holdToken = null;
        s.expiresAt = null;
      }
      notes.send(
        primaryBooking.passenger,
        "BOOKING",
        "Booking confirmed",
        groupRef +
          " • " +
          primaryBooking.trip.route.origin +
          " to " +
          primaryBooking.trip.route.destination +
          " • seats " +
          allSeatNumbers
      );
      notes.send(
        primaryBooking.passenger,
        "PAYMENT",
        "Payment confirmed",
        "LKR " +
          p.amount +
          " paid for " +
          groupRef +
          " (" + allSeatNumbers + "). Your receipt is available on the e-ticket."
      );
    }
    return paymentResult(p, allSeatNumbers);
  }

  @Transactional(readOnly = true)
  public Object list(int page, int size) {
    var u = current.get();
    var all = (current.has("BOOKINGS") || current.staff())
      ? bookings
          .findAll()
          .stream()
          .sorted(Comparator.comparing((Booking b) -> b.id).reversed())
          .toList()
      : bookings.findByPassengerIdOrderByIdDesc(u.id);
    return page(
      all
        .stream()
        .map(b ->
          Views.booking(
            b,
            payments.findFirstByBookingIdOrderByIdDesc(b.id).orElse(null)
          )
        )
        .toList(),
      page,
      size
    );
  }

  @Transactional(readOnly = true)
  public Object get(Long id) {
    var b = required(bookings.findById(id), "Booking");
    if (!current.has("BOOKINGS") && !current.staff()) current.owner(b.passenger.id);
    return Views.booking(
      b,
      payments.findFirstByBookingIdOrderByIdDesc(id).orElse(null)
    );
  }

  @Transactional(readOnly = true)
  public Object tripManifest(Long tripId) {
    check(current.staff() || current.has("BOOKINGS"), "FORBIDDEN", "Staff access is required.");
    return bookings
      .findByTripIdOrderByIdAsc(tripId)
      .stream()
      .map(b ->
        Views.booking(
          b,
          payments.findFirstByBookingIdOrderByIdDesc(b.id).orElse(null)
        )
      )
      .toList();
  }

  @Transactional(readOnly = true)
  public Object verify(String reference) {
    check(current.staff() || current.has("BOOKINGS"), "FORBIDDEN", "Staff access is required.");
    var b = bookings
      .findByReference(reference.trim())
      .orElseThrow(() -> new BusinessException("NOT_FOUND", "Ticket reference " + reference + " not found."));
    return Views.booking(
      b,
      payments.findFirstByBookingIdOrderByIdDesc(b.id).orElse(null)
    );
  }

  /**
   * QR scan boarding: finds booking by reference, marks BOARDED if CONFIRMED, errors if already boarded.
   * Returns full booking details including passenger name, seat, pickup/dropoff stops.
   */
  @Transactional
  public Object scanQr(String reference) {
    check(current.staff() || current.has("BOOKINGS"), "FORBIDDEN", "Staff access is required.");
    check(reference != null && !reference.isBlank(), "INVALID_QR", "QR code is empty or unreadable.");
    var b = bookings
      .findByReference(reference.trim().toUpperCase())
      .orElseThrow(() -> new BusinessException("NOT_FOUND", "QR code not recognised. Ticket reference '" + reference + "' does not exist."));

    if ("BOARDED".equals(b.status)) {
      // Already boarded — return data with an ALREADY_BOARDED error
      var bView = Views.booking(b, payments.findFirstByBookingIdOrderByIdDesc(b.id).orElse(null));
      throw new BusinessException("ALREADY_BOARDED",
        "This QR code has already been scanned. " + b.passengerName + " (Seat " + b.seat.number +
        ", " + (b.pickupStop != null ? b.pickupStop : b.trip.route.origin) + " \u2192 " +
        (b.dropoffStop != null ? b.dropoffStop : b.trip.route.destination) + ") is already marked as boarded.");
    }
    check("CONFIRMED".equals(b.status), "INVALID_STATUS",
      "This ticket cannot be boarded. Current status: " + b.status + ".");

    // Mark boarded
    b.status = "BOARDED";
    bookings.save(b);

    // Also mark the seat as booked (shouldn't need locking here, conductor has physical control)
    inventory.findByTripIdOrderById(b.trip.id).stream()
      .filter(s -> s.seat.id.equals(b.seat.id))
      .findFirst()
      .ifPresent(s -> {
        s.status = "BOOKED";
        s.heldBy = null;
        s.holdToken = null;
        s.expiresAt = null;
      });

    return Views.booking(b, payments.findFirstByBookingIdOrderByIdDesc(b.id).orElse(null));
  }

  @Transactional
  public Object board(Long id, String status) {

    check(current.staff() || current.has("BOOKINGS"), "FORBIDDEN", "Staff access is required.");
    var b = required(bookings.lockById(id), "Booking");
    b.status = oneOf(status, "CONFIRMED", "BOARDED", "NO_SHOW");
    bookings.save(b);
    return Views.booking(
      b,
      payments.findFirstByBookingIdOrderByIdDesc(b.id).orElse(null)
    );
  }

  @Transactional
  public Object onboard(Long tripId, OnboardTicket r) {
    check(current.staff() || current.has("BOOKINGS"), "FORBIDDEN", "Staff access is required.");
    var t = locks.trip(tripId);
    check(!Set.of("CANCELLED", "DRAFT").contains(t.status), "TRIP_UNAVAILABLE", "Cannot issue tickets for this trip.");
    var inv = inventory
      .findByTripIdOrderById(tripId)
      .stream()
      .filter(s -> s.seat.id.equals(r.seatId()))
      .findFirst()
      .orElseThrow(() -> new BusinessException("SEAT_NOT_FOUND", "Seat not found on this trip."));
    expire(List.of(inv));
    check(inv.status.equals("AVAILABLE"), "SEAT_UNAVAILABLE", "Seat " + inv.seat.number + " is not available.");

    var b = new Booking();
    b.passenger = current.get();
    b.trip = t;
    b.seat = inv.seat;
    b.passengerName = (r.passengerName() == null || r.passengerName().isBlank()) ? "Walk-in Passenger" : r.passengerName().trim();
    b.passengerPhone = (r.passengerPhone() == null || r.passengerPhone().isBlank()) ? "+94770000000" : r.passengerPhone().trim();
    b.reference = "CLX-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase();
    b.status = "BOARDED";
    b.totalAmount = t.fare;
    bookings.save(b);

    var p = new Payment();
    p.booking = b;
    p.amount = b.totalAmount;
    p.method = "CASH";
    p.status = "SUCCEEDED";
    p.transactionReference = "CASH-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    p.idempotencyKey = "onboard-" + b.reference;
    payments.save(p);

    inv.status = "BOOKED";
    inv.heldBy = null;
    inv.holdToken = null;
    inv.expiresAt = null;

    return Views.booking(b, p);
  }

  @Transactional
  public Object updateStops(Long id, BookingStops r) {
    var b = required(bookings.findById(id), "Booking");
    current.owner(b.passenger.id);
    if (r.pickupStop() != null && !r.pickupStop().isBlank()) {
      b.pickupStop = r.pickupStop().strip();
    }
    if (r.dropoffStop() != null && !r.dropoffStop().isBlank()) {
      b.dropoffStop = r.dropoffStop().strip();
    }
    bookings.save(b);
    return Views.booking(b, payments.findFirstByBookingIdOrderByIdDesc(b.id).orElse(null));
  }
}
