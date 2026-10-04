package com.citylink.util;

import com.citylink.exception.BusinessException;
import java.time.*;
import java.util.*;

public final class Values {

  public static Map<String, Object> map(Object... values) {
    var map = new LinkedHashMap<String, Object>();
    for (int i = 0; i < values.length; i += 2) map.put(
      (String) values[i],
      values[i + 1]
    );
    return map;
  }

  public static <T> T required(Optional<T> value, String what) {
    return value.orElseThrow(() ->
      new BusinessException("NOT_FOUND", what + " was not found.", 404)
    );
  }

  public static void check(boolean ok, String code, String message) {
    if (!ok) throw new BusinessException(code, message);
  }

  public static String oneOf(String value, String... choices) {
    check(
      Arrays.asList(choices).contains(value),
      "INVALID_VALUE",
      "Invalid value: " + value
    );
    return value;
  }

  public static LocalDateTime localNow() {
    return LocalDateTime.now(ZoneId.of("Asia/Colombo"));
  }

  public static <T> Map<String, Object> page(List<T> list, int page, int size) {
    int p = Math.max(0, page),
      s = Math.max(1, Math.min(size, 100)),
      start = (int) Math.min((long) p * s, list.size());
    return map(
      "items",
      list.subList(start, Math.min(start + s, list.size())),
      "page",
      p,
      "size",
      s,
      "total",
      list.size()
    );
  }
}
