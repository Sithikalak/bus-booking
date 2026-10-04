package com.citylink.controller;

import static com.citylink.dto.ApiResponse.ok;

import com.citylink.dto.ApiResponse;
import com.citylink.dto.Requests.*;
import com.citylink.service.*;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class BookingController {

  private final BookingService service;

  public BookingController(BookingService service) {
    this.service = service;
  }

  @GetMapping("/trips/{id}/seats")
  public Object seats(@PathVariable Long id) {
    return ok(service.seats(id));
  }

  @PostMapping("/trips/{id}/holds")
  public Object hold(@PathVariable Long id, @Valid @RequestBody Hold r) {
    return ok(service.hold(id, r.seatId()));
  }

  @GetMapping("/holds/{token}")
  public Object hold(@PathVariable String token) {
    return ok(service.getHold(token));
  }

  @DeleteMapping("/holds/{token}")
  public Object release(@PathVariable String token) {
    return ok(service.release(token));
  }

  @PostMapping("/payments/checkout")
  public Object checkout(@Valid @RequestBody Checkout r) {
    return ok(service.checkout(r));
  }

  @GetMapping("/bookings")
  public Object list(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size
  ) {
    return ok(service.list(page, size));
  }

  @GetMapping("/bookings/{id}")
  public Object get(@PathVariable Long id) {
    return ok(service.get(id));
  }

  @GetMapping("/trips/{id}/manifest")
  public Object manifest(@PathVariable Long id) {
    return ok(service.tripManifest(id));
  }

  @GetMapping("/bookings/verify")
  public Object verify(@RequestParam String reference) {
    return ok(service.verify(reference));
  }

  /**
   * QR scan endpoint — verifies AND immediately marks the booking as BOARDED in one step.
   * Accepts raw QR content such as "CITYLINK:CLX-XXXX" or the bare reference "CLX-XXXX".
   * Returns full passenger + trip details for the conductor to see on screen.
   * Throws ALREADY_BOARDED if the QR was already scanned.
   */
  @PostMapping("/bookings/scan-qr")
  public Object scanQr(@RequestBody Map<String, String> body) {
    String raw = body.getOrDefault("qr", "").trim();
    if (raw.toUpperCase().startsWith("CITYLINK:")) {
      raw = raw.substring("CITYLINK:".length()).trim();
    }
    return ok(service.scanQr(raw));
  }

  @PutMapping("/bookings/{id}/board")
  public Object board(
    @PathVariable Long id,
    @Valid @RequestBody BoardingUpdate r
  ) {
    return ok(service.board(id, r.status()));
  }

  @PostMapping("/trips/{id}/onboard-ticket")
  public Object onboardTicket(
    @PathVariable Long id,
    @Valid @RequestBody OnboardTicket r
  ) {
    return ok(service.onboard(id, r));
  }

  @PutMapping("/bookings/{id}/stops")
  public Object updateStops(
    @PathVariable Long id,
    @Valid @RequestBody BookingStops r
  ) {
    return ok(service.updateStops(id, r));
  }
}
