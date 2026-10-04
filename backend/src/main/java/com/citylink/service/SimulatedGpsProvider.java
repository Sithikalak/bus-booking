package com.citylink.service;

import static com.citylink.util.Values.*;

import com.citylink.entity.*;
import java.time.Duration;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = "app.development", havingValue = "true")
public class SimulatedGpsProvider implements GpsProvider {

  public Optional<Position> position(Trip t, List<RouteStop> stops) {
    if (!t.gpsAvailable || stops.size() < 2) return Optional.empty();
    double duration = Duration.between(t.departure, t.arrival).toSeconds();
    double elapsed = Duration.between(
      t.departure,
      localNow().minusMinutes(t.delayMinutes)
    ).toSeconds();
    double progress = t.status.equals("ARRIVED")
      ? 1
      : Math.max(0, Math.min(1, elapsed / duration));
    double minute = (progress * duration) / 60;
    int n = 1;
    while (n < stops.size() - 1 && stops.get(n).minutesFromDeparture < minute)
      n++;
    var a = stops.get(n - 1);
    var b = stops.get(n);
    double mix = Math.max(
      0,
      Math.min(
        1,
        (minute - a.minutesFromDeparture) /
          (b.minutesFromDeparture - a.minutesFromDeparture)
      )
    );
    return Optional.of(
      new Position(
        a.stop.latitude + (b.stop.latitude - a.stop.latitude) * mix,
        a.stop.longitude + (b.stop.longitude - a.stop.longitude) * mix,
        progress > 0 && progress < 1
          ? t.route.distanceKm / (duration / 3600)
          : 0,
        progress
      )
    );
  }
}
