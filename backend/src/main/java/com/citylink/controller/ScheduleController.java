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
public class ScheduleController {

  private final ScheduleService service;

  public ScheduleController(ScheduleService service) {
    this.service = service;
  }

  @GetMapping("/routes")
  public Object routes() {
    return ok(service.routes());
  }

  @PostMapping("/routes")
  public Object route(@Valid @RequestBody RouteInput r) {
    return ok(service.route(null, r));
  }

  @PutMapping("/routes/{id}")
  public Object route(@PathVariable Long id, @Valid @RequestBody RouteInput r) {
    return ok(service.route(id, r));
  }

  @PostMapping("/routes/upload-image")
  public Object uploadRouteImage(@RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
    return ok(service.uploadRouteImage(file));
  }

  @PostMapping("/routes/upload-image-data")
  public Object uploadRouteImageData(@RequestBody Map<String, String> payload) {
    String data = payload.get("data") != null ? payload.get("data") : payload.get("imageData");
    String name = payload.get("name") != null ? payload.get("name") : payload.get("preferredName");
    return ok(service.uploadRouteImageData(data, name));
  }

  @GetMapping("/trips")
  public Object search(
    @RequestParam(defaultValue = "") String origin,
    @RequestParam(defaultValue = "") String destination,
    @RequestParam(required = false) java.time.LocalDate date,
    @RequestParam(required = false) java.time.LocalTime time,
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size
  ) {
    return ok(service.search(origin, destination, date, time, page, size));
  }

  @GetMapping("/trips/{id}")
  public Object get(@PathVariable Long id) {
    return ok(service.get(id));
  }

  @GetMapping("/schedules")
  public Object schedules(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size
  ) {
    return ok(service.list(page, size));
  }

  @PostMapping("/schedules")
  public Object create(@Valid @RequestBody ScheduleInput r) {
    return ok(service.save(null, r));
  }

  @PutMapping("/schedules/{id}")
  public Object update(
    @PathVariable Long id,
    @Valid @RequestBody ScheduleInput r
  ) {
    return ok(service.save(id, r));
  }

  @PostMapping("/schedules/{id}/cancel")
  public Object cancel(@PathVariable Long id, @RequestBody Confirm r) {
    return ok(service.cancel(id, r.confirmChanges()));
  }

  @DeleteMapping("/schedules/{id}")
  public Object deleteSchedule(@PathVariable Long id) {
    return ok(service.deleteTrip(id));
  }

  @DeleteMapping("/trips/{id}")
  public Object deleteTrip(@PathVariable Long id) {
    return ok(service.deleteTrip(id));
  }

  @PostMapping("/trips/{id}/acknowledge")
  public Object acknowledge(@PathVariable Long id) {
    return ok(service.acknowledge(id));
  }

  @GetMapping("/staff/availability")
  public Object availability(
    @RequestParam java.time.LocalDateTime departure,
    @RequestParam java.time.LocalDateTime arrival,
    @RequestParam(required = false) Long excludeTripId
  ) {
    return ok(service.availability(departure, arrival, excludeTripId));
  }
}
