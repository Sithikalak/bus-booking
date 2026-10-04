package com.citylink.mapper;

import static com.citylink.util.Values.*;

import com.citylink.entity.*;
import java.util.*;

public final class Views {

  public static Map<String, Object> user(UserAccount u) {
    return map(
      "id",
      u.id,
      "firstName",
      u.firstName,
      "lastName",
      u.lastName,
      "email",
      u.email,
      "phone",
      u.phone,
      "role",
      u.role,
      "status",
      u.status,
      "verified",
      u.verified,
      "permissions",
      u.permissions.isBlank()
        ? List.of()
        : Arrays.asList(u.permissions.split(",")),
      "createdAt",
      u.createdAt
    );
  }

  public static Map<String, Object> staff(Staff s) {
    return map(
      "id",
      s.id,
      "employeeId",
      s.employeeId,
      "firstName",
      s.firstName,
      "lastName",
      s.lastName,
      "email",
      s.email,
      "phone",
      s.phone,
      "nic",
      s.nic,
      "role",
      s.role,
      "department",
      s.department,
      "licenseNumber",
      s.licenseNumber,
      "status",
      s.status,
      "available",
      s.available,
      "verified",
      true,
      "permissions",
      s.permissions.isBlank()
        ? List.of()
        : Arrays.asList(s.permissions.split(",")),
      "createdAt",
      s.createdAt
    );
  }

  public static Map<String, Object> bus(Bus b) {
    return map(
      "id",
      b.id,
      "registration",
      b.registration,
      "model",
      b.model,
      "capacity",
      b.capacity,
      "type",
      b.type,
      "features",
      b.features,
      "status",
      b.status
    );
  }

  public static Map<String, Object> route(Route r, List<RouteStop> stops) {
    return map(
      "id",
      r.id,
      "name",
      r.name,
      "origin",
      r.origin,
      "destination",
      r.destination,
      "distanceKm",
      r.distanceKm,
      "active",
      r.active,
      "imageUrl",
      r.imageUrl,
      "stops",
      stops
        .stream()
        .map(s ->
          map(
            "id",
            s.stop.id,
            "name",
            s.stop.name,
            "latitude",
            s.stop.latitude,
            "longitude",
            s.stop.longitude,
            "order",
            s.stopOrder,
            "minutesFromDeparture",
            s.minutesFromDeparture
          )
        )
        .toList()
    );
  }

  public static Map<String, Object> trip(
    Trip t,
    int available,
    List<RouteStop> stops
  ) {
    return trip(t, available, stops, true, true, true);
  }

  public static Map<String, Object> trip(
    Trip t,
    int available,
    List<RouteStop> stops,
    boolean driverOnline,
    boolean conductorOnline,
    boolean crewOnline
  ) {
    return map(
      "id",
      t.id,
      "routeId",
      t.route.id,
      "origin",
      t.route.origin,
      "destination",
      t.route.destination,
      "routeName",
      t.route.name,
      "distanceKm",
      t.route.distanceKm,
      "bus",
      t.bus == null ? null : bus(t.bus),
      "driver",
      t.driver == null
        ? null
        : map(
            "id",
            t.driver.id,
            "name",
            t.driver.firstName + " " + t.driver.lastName,
            "online",
            driverOnline
          ),
      "conductor",
      t.conductor == null
        ? null
        : map(
            "id",
            t.conductor.id,
            "name",
            t.conductor.firstName + " " + t.conductor.lastName,
            "online",
            conductorOnline
          ),
      "crewOnline",
      crewOnline,
      "departure",
      t.departure,
      "arrival",
      t.arrival,
      "durationMinutes",
      java.time.Duration.between(t.departure, t.arrival).toMinutes(),
      "fare",
      t.fare,
      "status",
      t.status,
      "availableSeats",
      available,
      "delayMinutes",
      t.delayMinutes,
      "gpsAvailable",
      t.gpsAvailable,
      "driverAcknowledged",
      t.driverAcknowledged,
      "conductorAcknowledged",
      t.conductorAcknowledged,
      "stops",
      stops
        .stream()
        .map(s ->
          map(
            "name",
            s.stop.name,
            "latitude",
            s.stop.latitude,
            "longitude",
            s.stop.longitude,
            "order",
            s.stopOrder,
            "eta",
            t.departure.plusMinutes(s.minutesFromDeparture + t.delayMinutes)
          )
        )
        .toList()
    );
  }

  public static Map<String, Object> seat(TripSeat i) {
    return map(
      "id",
      i.seat.id,
      "inventoryId",
      i.id,
      "number",
      i.seat.number,
      "row",
      i.seat.rowNumber,
      "column",
      i.seat.columnNumber,
      "type",
      i.seat.type,
      "position",
      i.seat.position,
      "status",
      i.seat.enabled ? i.status : "DISABLED"
    );
  }

  public static Map<String, Object> booking(Booking b, Payment p) {
    return map(
      "id",
      b.id,
      "reference",
      b.reference,
      "passengerId",
      b.passenger.id,
      "passengerName",
      b.passengerName,
      "passengerPhone",
      b.passengerPhone,
      "tripId",
      b.trip.id,
      "origin",
      b.trip.route.origin,
      "destination",
      b.trip.route.destination,
      "departure",
      b.trip.departure,
      "arrival",
      b.trip.arrival,
      "tripStatus",
      b.trip.status,
      "bus",
      b.trip.bus.registration,
      "seat",
      b.seat.number,
      "pickupStop",
      b.pickupStop != null ? b.pickupStop : b.trip.route.origin,
      "dropoffStop",
      b.dropoffStop != null ? b.dropoffStop : b.trip.route.destination,
      "status",
      b.status,
      "totalAmount",
      b.totalAmount,
      "createdAt",
      b.createdAt,
      "paymentStatus",
      p == null ? null : p.status,
      "paymentReference",
      p == null ? null : p.transactionReference,
      "paymentMethod",
      p == null ? null : p.method
    );
  }

  public static Map<String, Object> notification(Notification n) {
    return map(
      "id",
      n.id,
      "type",
      n.type,
      "title",
      n.title,
      "message",
      n.message,
      "read",
      n.isRead,
      "createdAt",
      n.createdAt,
      "role",
      n.recipient != null ? n.recipient.role : "PASSENGER",
      "recipientId",
      n.recipient != null ? n.recipient.id : null,
      "recipientName",
      n.recipient != null ? (n.recipient.firstName + " " + n.recipient.lastName) : "User"
    );
  }

  public static Map<String, Object> request(SupportRequest s) {
    return map(
      "id",
      s.id,
      "passengerName",
      s.passenger.firstName + " " + s.passenger.lastName,
      "category",
      s.category,
      "subject",
      s.subject,
      "description",
      s.description,
      "status",
      s.status,
      "response",
      s.response,
      "createdAt",
      s.createdAt,
      "updatedAt",
      s.updatedAt
    );
  }

  public static Map<String, Object> refund(Refund r) {
    return map(
      "id",
      r.id,
      "bookingId",
      r.booking.id,
      "bookingReference",
      r.booking.reference,
      "passengerName",
      r.booking.passengerName,
      "reason",
      r.reason,
      "amount",
      r.amount,
      "status",
      r.status,
      "rejectionReason",
      r.rejectionReason,
      "attempts",
      r.attempts,
      "gatewayReference",
      r.gatewayReference,
      "createdAt",
      r.createdAt,
      "updatedAt",
      r.updatedAt
    );
  }

  public static Map<String, Object> incident(Incident i) {
    return map(
      "id",
      i.id,
      "busId",
      i.bus.id,
      "bus",
      i.bus.registration,
      "reportedBy",
      i.reportedBy.firstName + " " + i.reportedBy.lastName,
      "type",
      i.type,
      "description",
      i.description,
      "priority",
      i.priority,
      "status",
      i.status,
      "createdAt",
      i.createdAt,
      "resolvedAt",
      i.resolvedAt
    );
  }
}
