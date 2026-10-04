package com.citylink.service;

import static com.citylink.util.Values.*;

import com.citylink.repository.TripRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class TrackingJob {

  private final TripRepository trips;
  private final TrackingService tracking;
  private final boolean enabled;

  public TrackingJob(
    TripRepository trips,
    TrackingService tracking,
    @Value("${app.tracking-simulation}") boolean enabled
  ) {
    this.trips = trips;
    this.tracking = tracking;
    this.enabled = enabled;
  }

  @Scheduled(fixedDelay = 15000, initialDelay = 5000)
  public void tick() {
    if (enabled) trips
      .findAll()
      .stream()
      .filter(
        t ->
          "IN_TRANSIT".equals(t.status) &&
          t.arrival.isAfter(localNow().minusHours(2)) &&
          t.departure.isBefore(localNow().plusHours(24))
      )
      .forEach(t -> tracking.tick(t.id));
  }
}
