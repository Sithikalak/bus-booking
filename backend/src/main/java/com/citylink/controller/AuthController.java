package com.citylink.controller;

import static com.citylink.dto.ApiResponse.ok;

import com.citylink.dto.ApiResponse;
import com.citylink.dto.Requests.*;
import com.citylink.service.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AuthController {

  private final AuthService service;

  public AuthController(AuthService service) {
    this.service = service;
  }

  @PostMapping("/auth/register")
  public Object register(@Valid @RequestBody Register r) {
    return ok(service.register(r));
  }

  @PostMapping("/auth/verify")
  public Object verify(@Valid @RequestBody Verify r) {
    return ok(service.verify(r));
  }

  @PostMapping("/auth/resend")
  public Object resend(@Valid @RequestBody ChallengeId r) {
    return ok(service.resend(r));
  }

  @PostMapping("/auth/login")
  public Object login(@Valid @RequestBody Login r) {
    return ok(service.login(r));
  }

  @PostMapping("/auth/recover")
  public Object recover(@Valid @RequestBody Recover r) {
    return ok(service.recover(r));
  }

  @PostMapping("/auth/reset")
  public Object reset(@Valid @RequestBody Reset r) {
    return ok(service.reset(r));
  }

  @PostMapping("/auth/logout")
  public Object logout() {
    return ok(service.logout());
  }

  @GetMapping("/auth/me")
  public Object me() {
    return ok(service.me());
  }

  @GetMapping("/health")
  public Object health() {
    return ok(
      java.util.Map.of("status", "UP", "application", "CityLink Express")
    );
  }
}
