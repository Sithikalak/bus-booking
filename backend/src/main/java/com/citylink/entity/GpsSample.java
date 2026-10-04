package com.citylink.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "gps_samples")
public class GpsSample {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "trip_id", nullable = false)
  public Trip trip;

  @Column(name = "latitude", nullable = false)
  public double latitude;

  @Column(name = "longitude", nullable = false)
  public double longitude;

  @Column(name = "speed", nullable = false)
  public double speed;

  @Column(name = "progress", nullable = false)
  public double progress;

  @Column(name = "recorded_at", nullable = false)
  public Instant recordedAt = Instant.now();
}
