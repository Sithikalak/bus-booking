package com.citylink.service;

import com.citylink.repository.TripSeatRepository;
import java.time.Instant;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class SeatExpirationJob {

  private final TripSeatRepository inventory;
  private final BookingService bookings;

  public SeatExpirationJob(
    TripSeatRepository inventory,
    BookingService bookings
  ) {
    this.inventory = inventory;
    this.bookings = bookings;
  }

  @Scheduled(fixedDelay = 15000)
  public void expire() {
    inventory
      .findByStatusAndExpiresAtBefore("HELD", Instant.now())
      .stream()
      .map(s -> s.trip.id)
      .distinct()
      .forEach(bookings::expireTrip);
  }
}
