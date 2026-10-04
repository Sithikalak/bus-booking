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
public class TrackingController {

  private final TrackingService service;

  public TrackingController(TrackingService service) {
    this.service = service;
  }

  @GetMapping("/tracking/{id}")
  public Object get(@PathVariable Long id) {
    return ok(service.get(id));
  }

  @PutMapping("/tracking/{id}")
  public Object update(
    @PathVariable Long id,
    @Valid @RequestBody TrackingInput r
  ) {
    return ok(service.update(id, r));
  }

  @GetMapping("/trips/{id}/tracking")
  public Object getTripTracking(@PathVariable Long id) {
    return ok(service.get(id));
  }

  @PostMapping("/trips/{id}/start")
  public Object startTrip(@PathVariable Long id) {
    return ok(service.startTrip(id));
  }

  @PostMapping("/trips/{id}/stop")
  public Object stopTrip(@PathVariable Long id) {
    return ok(service.stopTrip(id));
  }

  @RequestMapping(value = "/trips/{id}/delay", method = { RequestMethod.POST, RequestMethod.PUT })
  public Object updateDelay(
    @PathVariable Long id,
    @RequestBody Map<String, Object> payload
  ) {
    int delayMinutes = 0;
    if (payload.containsKey("delayMinutes")) {
      Object dm = payload.get("delayMinutes");
      if (dm instanceof Number) {
        delayMinutes = ((Number) dm).intValue();
      } else {
        try {
          delayMinutes = Integer.parseInt(dm.toString());
        } catch (Exception ignored) {}
      }
    }
    String reason = payload.getOrDefault("reason", "").toString();
    return ok(service.updateDelay(id, delayMinutes, reason));
  }

  @PutMapping("/trips/{id}/status")
  public Object updateStatus(
    @PathVariable Long id,
    @RequestBody Map<String, Object> payload
  ) {
    String status = payload.getOrDefault("status", "IN_TRANSIT").toString();
    return ok(service.updateTripStatus(id, status));
  }

  @GetMapping("/trips/{id}/tracking-manifest")
  public Object getManifest(@PathVariable Long id) {
    return ok(service.manifest(id));
  }

  @RequestMapping(value = "/trips/{id}/telemetry", method = { RequestMethod.POST, RequestMethod.PUT })
  public Object updateTelemetry(
    @PathVariable Long id,
    @RequestBody Map<String, Object> payload
  ) {
    return ok(service.updateTelemetry(id, payload));
  }
}
