package com.citylink.controller;

import static com.citylink.dto.ApiResponse.ok;

import com.citylink.dto.ApiResponse;
import com.citylink.dto.Requests.*;
import com.citylink.service.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AccountController {

  private final AccountService service;

  public AccountController(AccountService service) {
    this.service = service;
  }

  @GetMapping("/users")
  public Object list(
    @RequestParam(defaultValue = "") String q,
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size
  ) {
    return ok(service.list(q, page, size));
  }

  @PostMapping("/users")
  public Object create(@Valid @RequestBody UserInput r) {
    return ok(service.save(null, r));
  }

  @PutMapping("/users/{id}")
  public Object update(@PathVariable Long id, @Valid @RequestBody UserInput r) {
    return ok(service.save(id, r));
  }

  @PutMapping("/users/{id}/toggle-status")
  public Object toggleStatus(@PathVariable Long id) {
    return ok(service.toggleStatus(id));
  }

  @DeleteMapping("/users/{id}")
  public Object delete(@PathVariable Long id) {
    return ok(service.delete(id));
  }

  @PutMapping("/staff/{id}/toggle-status")
  public Object toggleStaffStatus(@PathVariable Long id) {
    return ok(service.toggleStatus(id));
  }

  @DeleteMapping("/staff/{id}")
  public Object deleteStaff(@PathVariable Long id) {
    return ok(service.delete(id));
  }

  @PutMapping("/users/me")
  public Object profile(@Valid @RequestBody Profile r) {
    return ok(service.profile(r));
  }
}
