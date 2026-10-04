package com.citylink.security;

import static com.citylink.util.Values.*;

import java.util.*;

public final class Permissions {

  public static final Set<String> ALL = Set.of(
    "SCHEDULES",
    "FLEET",
    "BOOKINGS",
    "TRACKING",
    "SUPPORT",
    "REPORTS",
    "USERS"
  );
  public static final Set<String> ROLES = Set.of(
    "PASSENGER",
    "DRIVER",
    "CONDUCTOR",
    "OPERATOR",
    "ADMIN",
    "CUSTOMER_SERVICE"
  );

  public static Set<String> allowed(String role) {
    return switch (role) {
      case "ADMIN" -> ALL;
      case "OPERATOR" -> Set.of(
        "SCHEDULES",
        "FLEET",
        "BOOKINGS",
        "TRACKING",
        "REPORTS"
      );
      case "CUSTOMER_SERVICE" -> Set.of("SUPPORT", "BOOKINGS");
      default -> Set.of();
    };
  }

  public static String validate(String role, List<String> values) {
    check(ROLES.contains(role), "INVALID_ROLE", "Choose a valid role.");
    var selected = values == null ? allowed(role) : new HashSet<>(values);
    check(
      allowed(role).containsAll(selected),
      "INVALID_PERMISSION",
      "A permission is not allowed for this role."
    );
    return String.join(",", role.equals("ADMIN") ? ALL : selected);
  }
}
