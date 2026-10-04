package com.citylink.service;

import static com.citylink.util.Values.*;

import com.citylink.dto.Requests.*;
import com.citylink.entity.*;
import com.citylink.mapper.Views;
import com.citylink.repository.*;
import com.citylink.security.CurrentUser;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupportService {

  private final SupportRequestRepository requests;
  private final RefundRepository refunds;
  private final BookingRepository bookings;
  private final PaymentRepository payments;
  private final CurrentUser current;
  private final NotificationService notes;
  private final PaymentGateway gateway;
  private final LockService locks;

  public SupportService(
    SupportRequestRepository requests,
    RefundRepository refunds,
    BookingRepository bookings,
    PaymentRepository payments,
    CurrentUser current,
    NotificationService notes,
    PaymentGateway gateway,
    LockService locks
  ) {
    this.requests = requests;
    this.refunds = refunds;
    this.bookings = bookings;
    this.payments = payments;
    this.current = current;
    this.notes = notes;
    this.gateway = gateway;
    this.locks = locks;
  }

  @Transactional(readOnly = true)
  public Object requests() {
    return requests
      .findAll()
      .stream()
      .filter(
        s -> current.has("SUPPORT") || s.passenger.id.equals(current.get().id)
      )
      .sorted(Comparator.comparing((SupportRequest r) -> r.id).reversed())
      .map(Views::request)
      .toList();
  }

  @Transactional
  public Object create(SupportInput r) {
    oneOf(r.category(), "INQUIRY", "COMPLAINT");
    var s = new SupportRequest();
    s.passenger = current.get();
    s.category = r.category();
    s.subject = r.subject();
    s.description = r.description();
    requests.save(s);
    notes.role(
      "CUSTOMER_SERVICE",
      "SUPPORT",
      "New " + s.category.toLowerCase(),
      s.subject
    );
    return Views.request(s);
  }

  @Transactional
  public Object respond(Long id, SupportUpdate r) {
    current.require("SUPPORT");
    var s = required(requests.lockById(id), "Service request");
    s.status = oneOf(r.status(), "OPEN", "IN_REVIEW", "RESOLVED", "REJECTED");
    s.response = r.response();
    s.updatedAt = Instant.now();
    notes.send(s.passenger, "SUPPORT", "Response to " + s.subject, s.response);
    return Views.request(s);
  }

  @Transactional(readOnly = true)
  public Object refunds() {
    return refunds
      .findAll()
      .stream()
      .filter(
        r ->
          current.has("SUPPORT") ||
          r.booking.passenger.id.equals(current.get().id)
      )
      .sorted(Comparator.comparing((Refund r) -> r.id).reversed())
      .map(Views::refund)
      .toList();
  }

  @Transactional
  public Object refund(RefundInput r) {
    var b = required(bookings.findById(r.bookingId()), "Booking");
    current.owner(b.passenger.id);
    locks.trip(b.trip.id);
    locks.refresh(b);
    check(
      b.trip.status.equals("CANCELLED") && b.status.equals("CONFIRMED"),
      "REFUND_INELIGIBLE",
      "Refunds are available for paid tickets on cancelled trips."
    );
    var p = required(
      payments.findFirstByBookingIdOrderByIdDesc(b.id),
      "Payment"
    );
    check(
      p.status.equals("SUCCEEDED"),
      "REFUND_INELIGIBLE",
      "The booking has no successful payment."
    );
    check(
      refunds.findByBookingId(b.id).isEmpty(),
      "REFUND_EXISTS",
      "A refund request already exists for this booking."
    );
    var f = new Refund();
    f.booking = b;
    f.reason = r.reason();
    f.amount = b.totalAmount;
    f.status = "REQUESTED";
    refunds.save(f);
    notes.role(
      "CUSTOMER_SERVICE",
      "REFUND",
      "Refund review requested",
      b.reference + " • LKR " + b.totalAmount
    );
    notes.send(
      b.passenger,
      "REFUND",
      "Refund request received",
      "Your request for " + b.reference + " is awaiting review."
    );
    return Views.refund(f);
  }

  private Refund locked(Long id) {
    var f = required(refunds.findById(id), "Refund");
    locks.trip(f.booking.trip.id);
    var result = required(refunds.lockById(id), "Refund");
    locks.refresh(result);
    return result;
  }

  @Transactional
  public Object review(Long id, RefundReview r) {
    current.require("SUPPORT");
    var f = locked(id);
    check(
      f.status.equals("REQUESTED"),
      "REFUND_REVIEWED",
      "This request has already been reviewed."
    );
    f.reviewedBy = current.get();
    f.updatedAt = Instant.now();
    if (!r.approve()) {
      check(
        r.reason() != null && !r.reason().isBlank(),
        "REASON_REQUIRED",
        "Enter a reason for rejecting the refund."
      );
      f.status = "REJECTED";
      f.rejectionReason = r.reason();
      notes.send(
        f.booking.passenger,
        "REFUND",
        "Refund request rejected",
        r.reason()
      );
      return Views.refund(f);
    }
    check(
      f.booking.trip.status.equals("CANCELLED") &&
        f.booking.status.equals("CONFIRMED"),
      "REFUND_INELIGIBLE",
      "Only paid bookings on cancelled trips can be refunded."
    );
    f.status = "APPROVED";
    process(f);
    return Views.refund(f);
  }

  private void process(Refund f) {
    var p = required(
      payments.findFirstByBookingIdOrderByIdDesc(f.booking.id),
      "Payment"
    );
    f.status = "PROCESSING";
    PaymentGateway.Result result = null;
    for (int attempt = 0; attempt < 2; attempt++) {
      f.attempts++;
      result = gateway.refund(
        p.transactionReference,
        f.amount,
        "refund-" + f.id,
        p.refundFailure
      );
      if (result.success()) break;
    }
    f.updatedAt = Instant.now();
    if (result != null && result.success()) {
      f.status = "COMPLETED";
      f.gatewayReference = result.reference();
      f.booking.status = "REFUNDED";
      p.status = "REFUNDED";
      notes.send(
        f.booking.passenger,
        "REFUND",
        "Refund completed",
        "LKR " + f.amount + " refunded for " + f.booking.reference + "."
      );
    } else {
      f.status = "FAILED";
      notes.role(
        "ADMIN",
        "REFUND",
        "Refund needs administrator attention",
        "Refund #" +
          f.id +
          " failed twice. Review the gateway and retry from Customer service."
      );
      notes.send(
        f.booking.passenger,
        "REFUND",
        "Refund requires manual attention",
        "Your approved refund has been escalated to an administrator after gateway retries failed."
      );
    }
  }

  @Transactional
  public Object retry(Long id) {
    current.require("USERS");
    var f = locked(id);
    check(
      f.status.equals("FAILED"),
      "INVALID_TRANSITION",
      "Only failed refunds can be retried."
    );
    process(f);
    return Views.refund(f);
  }
}
