package com.citylink.controller;

import static com.citylink.dto.ApiResponse.ok;

import com.citylink.dto.ApiResponse;
import com.citylink.dto.Requests.*;
import com.citylink.service.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ReportController {

  private final ReportService service;

  public ReportController(ReportService service) {
    this.service = service;
  }

  @GetMapping("/public/summary")
  public Object summary() {
    return ok(service.summary());
  }

  @GetMapping({ "/dashboard", "/reports" })
  public Object dashboard() {
    return ok(service.dashboard());
  }
}
