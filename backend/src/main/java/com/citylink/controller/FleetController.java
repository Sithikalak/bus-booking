package com.citylink.controller;

import static com.citylink.dto.ApiResponse.ok;

import com.citylink.dto.ApiResponse;
import com.citylink.dto.Requests.*;
import com.citylink.service.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class FleetController {

  private final FleetService service;

  public FleetController(FleetService service) {
    this.service = service;
  }

  @GetMapping("/buses")
  public Object buses() {
    return ok(service.buses());
  }

  @PostMapping("/buses")
  public Object bus(@Valid @RequestBody BusInput r) {
    return ok(service.bus(null, r));
  }

  @PutMapping("/buses/{id}")
  public Object bus(@PathVariable Long id, @Valid @RequestBody BusInput r) {
    return ok(service.bus(id, r));
  }

  @GetMapping("/staff")
  public Object staff() {
    return ok(service.staff());
  }

  @PostMapping("/staff")
  public Object createStaff(@RequestBody java.util.Map<String, Object> payload) {
    return ok(service.createStaff(payload));
  }

  @PutMapping("/staff/{id}")
  public Object staff(@PathVariable Long id, @Valid @RequestBody StaffInput r) {
    return ok(service.staff(id, r));
  }

  @GetMapping("/incidents")
  public Object incidents() {
    return ok(service.incidents());
  }

  @PostMapping("/incidents")
  public Object incident(@Valid @RequestBody IncidentInput r) {
    return ok(service.incident(r));
  }

  @PutMapping("/incidents/{id}")
  public Object incident(
    @PathVariable Long id,
    @Valid @RequestBody IncidentUpdate r
  ) {
    return ok(service.incident(id, r));
  }
}
