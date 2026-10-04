package com.citylink.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "seats")
public class Seat {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "bus_id", nullable = false)
  public Bus bus;

  @Column(name = "number", nullable = false, length = 12)
  public String number;

  @Column(name = "seat_row", nullable = false)
  public int rowNumber;

  @Column(name = "column_number", nullable = false)
  public int columnNumber;

  @Column(name = "type", nullable = false, length = 24)
  public String type;

  @Column(name = "position", nullable = false, length = 24)
  public String position;

  @Column(name = "enabled", nullable = false)
  public boolean enabled = true;
}
