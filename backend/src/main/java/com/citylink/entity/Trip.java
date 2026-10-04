package com.citylink.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "trips")
public class Trip {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "route_id", nullable = false)
  public Route route;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "bus_id", nullable = true)
  public Bus bus;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "driver_id", nullable = true)
  public UserAccount driver;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "conductor_id", nullable = true)
  public UserAccount conductor;

  @Column(name = "departure", nullable = false)
  public LocalDateTime departure;

  @Column(name = "arrival", nullable = false)
  public LocalDateTime arrival;

  @Column(name = "fare", nullable = false, precision = 12, scale = 2)
  public BigDecimal fare;

  @Column(name = "status", nullable = false, length = 32)
  public String status;

  @Column(name = "driver_acknowledged", nullable = false)
  public boolean driverAcknowledged = false;

  @Column(name = "conductor_acknowledged", nullable = false)
  public boolean conductorAcknowledged = false;

  @Column(name = "delay_minutes", nullable = false)
  public int delayMinutes = 0;

  @Column(name = "gps_available", nullable = false)
  public boolean gpsAvailable = true;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt = Instant.now();
}
