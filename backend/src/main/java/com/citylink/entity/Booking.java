package com.citylink.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "bookings")
public class Booking {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "passenger_id", nullable = false)
  public UserAccount passenger;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "trip_id", nullable = false)
  public Trip trip;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "seat_id", nullable = false)
  public Seat seat;

  @Column(name = "reference", nullable = false, length = 40)
  public String reference;

  @Column(name = "passenger_name", nullable = false, length = 160)
  public String passengerName;

  @Column(name = "passenger_phone", nullable = false, length = 24)
  public String passengerPhone;

  @Column(name = "status", nullable = false, length = 32)
  public String status;

  @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
  public BigDecimal totalAmount;

  @Column(name = "pickup_stop", length = 120)
  public String pickupStop;

  @Column(name = "dropoff_stop", length = 120)
  public String dropoffStop;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt = Instant.now();
}
