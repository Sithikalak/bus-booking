package com.citylink.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "route_stops")
public class RouteStop {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "route_id", nullable = false)
  public Route route;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "stop_id", nullable = false)
  public Stop stop;

  @Column(name = "stop_order", nullable = false)
  public int stopOrder;

  @Column(name = "minutes_from_departure", nullable = false)
  public int minutesFromDeparture;
}
