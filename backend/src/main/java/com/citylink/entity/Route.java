package com.citylink.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "routes")
public class Route {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "name", nullable = false, length = 150)
  public String name;

  @Column(name = "origin", nullable = false, length = 80)
  public String origin;

  @Column(name = "destination", nullable = false, length = 80)
  public String destination;

  @Column(name = "distance_km", nullable = false)
  public double distanceKm;

  @Column(name = "active", nullable = false)
  public boolean active = true;

  @Column(name = "image_url", length = 500)
  public String imageUrl;
}
