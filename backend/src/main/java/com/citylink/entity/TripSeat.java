package com.citylink.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "trip_seats")
public class TripSeat {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "trip_id", nullable = false)
  public Trip trip;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "seat_id", nullable = false)
  public Seat seat;

  @Column(name = "status", nullable = false, length = 24)
  public String status = "AVAILABLE";

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "held_by_id", nullable = true)
  public UserAccount heldBy;

  @Column(name = "hold_token", nullable = true, length = 64)
  public String holdToken;

  @Column(name = "expires_at", nullable = true)
  public Instant expiresAt;
}
