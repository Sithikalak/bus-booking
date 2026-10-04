package com.citylink.controller;

import static com.citylink.dto.ApiResponse.ok;

import com.citylink.dto.ApiResponse;
import com.citylink.dto.Requests.*;
import com.citylink.service.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class SupportController {

  private final SupportService service;
  private final NotificationService notes;

  public SupportController(SupportService service, NotificationService notes) {
    this.service = service;
    this.notes = notes;
  }

  @GetMapping("/customer-service")
  public Object requests() {
    return ok(service.requests());
  }

  @PostMapping("/customer-service")
  public Object create(@Valid @RequestBody SupportInput r) {
    return ok(service.create(r));
  }

  @PutMapping("/customer-service/{id}")
  public Object respond(
    @PathVariable Long id,
    @Valid @RequestBody SupportUpdate r
  ) {
    return ok(service.respond(id, r));
  }

  @GetMapping("/refunds")
  public Object refunds() {
    return ok(service.refunds());
  }

  @PostMapping("/refunds")
  public Object refund(@Valid @RequestBody RefundInput r) {
    return ok(service.refund(r));
  }

  @PostMapping("/refunds/{id}/review")
  public Object review(
    @PathVariable Long id,
    @Valid @RequestBody RefundReview r
  ) {
    return ok(service.review(id, r));
  }

  @PostMapping("/refunds/{id}/retry")
  public Object retry(@PathVariable Long id) {
    return ok(service.retry(id));
  }

  @GetMapping("/notifications")
  public Object notifications(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "30") int size,
    @RequestParam(required = false) String role,
    @RequestParam(required = false) Boolean all
  ) {
    return ok(notes.list(page, size, role, all));
  }

  @PutMapping("/notifications/{id}")
  public Object read(@PathVariable Long id, @RequestBody Read r) {
    return ok(notes.read(id, r.read()));
  }

  @PutMapping("/notifications/read-all")
  public Object readAll() {
    return ok(notes.readAll());
  }
}
