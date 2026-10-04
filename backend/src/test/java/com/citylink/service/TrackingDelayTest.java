package com.citylink.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class TrackingDelayTest {

  private final LocalDateTime departure = LocalDateTime.of(2026, 10, 1, 8, 0);
  private final LocalDateTime arrival = departure.plusHours(2);

  @Test
  void detectsDelayFromPositionAgainstTimetable() {
    assertEquals(
      20,
      TrackingService.detectedDelay(
        departure,
        arrival,
        departure.plusMinutes(80),
        .5
      )
    );
  }

  @Test
  void onTimeAndEarlyPositionsDoNotShowNegativeDelay() {
    assertEquals(
      0,
      TrackingService.detectedDelay(
        departure,
        arrival,
        departure.plusHours(1),
        .5
      )
    );
    assertEquals(
      0,
      TrackingService.detectedDelay(
        departure,
        arrival,
        departure.plusMinutes(45),
        .5
      )
    );
  }

  @Test
  void stationaryBusAfterDepartureIsDelayed() {
    assertEquals(
      15,
      TrackingService.detectedDelay(
        departure,
        arrival,
        departure.plusMinutes(15),
        0
      )
    );
  }
}
