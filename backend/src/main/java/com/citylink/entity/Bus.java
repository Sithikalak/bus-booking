package com.citylink.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "buses")
public class Bus {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "registration", nullable = false, length = 40)
  public String registration;

  @Column(name = "model", nullable = false, length = 120)
  public String model;

  @Column(name = "capacity", nullable = false)
  public int capacity;

  @Column(name = "type", nullable = false, length = 60)
  public String type;

  @Column(name = "features", nullable = false, length = 500)
  public String features;

  @Column(name = "status", nullable = false, length = 32)
  public String status;
}
