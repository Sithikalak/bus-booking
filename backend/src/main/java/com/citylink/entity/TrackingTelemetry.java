package com.citylink.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "tracking_telemetry")
public class TrackingTelemetry {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @OneToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "tracking_id", nullable = false, unique = true)
  public TripTracking tracking;

  @Column(name = "latitude", nullable = false)
  public double latitude;

  @Column(name = "longitude", nullable = false)
  public double longitude;

  @Column(name = "speed", nullable = false)
  public double speed = 0.0;

  @Column(name = "progress", nullable = false)
  public double progress = 0.0;

  @Column(name = "last_heartbeat", nullable = false)
  public Instant lastHeartbeat = Instant.now();

  @Column(name = "created_at", nullable = false)
  public Instant createdAt = Instant.now();
}
