package com.citylink.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "stops")
public class Stop {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "name", nullable = false, length = 120)
  public String name;

  @Column(name = "latitude", nullable = false)
  public double latitude;

  @Column(name = "longitude", nullable = false)
  public double longitude;
}
