package com.citylink.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "trip_tracking")
public class TripTracking {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @OneToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "trip_id", nullable = false, unique = true)
  public Trip trip;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "driver_id", nullable = true)
  public UserAccount driver;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "bus_id", nullable = true)
  public Bus bus;

  @Column(name = "status", nullable = false, length = 32)
  public String status = "SCHEDULED";

  @Column(name = "is_live", nullable = false)
  public boolean isLive = false;

  @Column(name = "started_at")
  public Instant startedAt;

  @Column(name = "ended_at")
  public Instant endedAt;

  @Column(name = "delay_minutes", nullable = false)
  public int delayMinutes = 0;

  @Column(name = "delay_reason", length = 255)
  public String delayReason;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "approaching_stop_id")
  public Stop approachingStop;

  @Column(name = "total_pickups", nullable = false)
  public int totalPickups = 0;

  @Column(name = "total_dropoffs", nullable = false)
  public int totalDropoffs = 0;

  @Column(name = "updated_at", nullable = false)
  public Instant updatedAt = Instant.now();

  @OneToOne(mappedBy = "tracking", cascade = CascadeType.ALL, fetch = FetchType.EAGER, orphanRemoval = true)
  public TrackingTelemetry telemetry;
}
