package com.citylink.controller;

import static com.citylink.dto.ApiResponse.ok;

import com.citylink.security.CurrentUser;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/settings")
public class SettingController {

  private final JdbcTemplate jdbc;
  private final CurrentUser current;

  public SettingController(JdbcTemplate jdbc, CurrentUser current) {
    this.jdbc = jdbc;
    this.current = current;
  }

  @GetMapping
  public Object list() {
    var rows = jdbc.queryForList(
      "SELECT setting_key, setting_value, description, category, updated_at FROM system_settings ORDER BY category, setting_key"
    );
    return ok(rows);
  }

  @PutMapping
  @Transactional
  public Object update(@RequestBody Map<String, String> payload) {
    current.require("USERS");
    for (Map.Entry<String, String> entry : payload.entrySet()) {
      jdbc.update(
        "UPDATE system_settings SET setting_value = ? WHERE setting_key = ?",
        entry.getValue(),
        entry.getKey()
      );
    }
    return list();
  }
}
