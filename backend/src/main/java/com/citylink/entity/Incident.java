package com.citylink.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "incidents")
public class Incident {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "bus_id", nullable = false)
  public Bus bus;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "reported_by_id", nullable = false)
  public UserAccount reportedBy;

  @Column(name = "type", nullable = false, length = 60)
  public String type;

  @Column(name = "description", nullable = false, length = 2000)
  public String description;

  @Column(name = "priority", nullable = false, length = 20)
  public String priority;

  @Column(name = "status", nullable = false, length = 24)
  public String status = "OPEN";

  @Column(name = "created_at", nullable = false)
  public Instant createdAt = Instant.now();

  @Column(name = "resolved_at", nullable = true)
  public Instant resolvedAt;
}
