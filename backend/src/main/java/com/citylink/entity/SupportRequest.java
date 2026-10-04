package com.citylink.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "support_requests")
public class SupportRequest {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "passenger_id", nullable = false)
  public UserAccount passenger;

  @Column(name = "category", nullable = false, length = 24)
  public String category;

  @Column(name = "subject", nullable = false, length = 160)
  public String subject;

  @Column(name = "description", nullable = false, length = 2000)
  public String description;

  @Column(name = "status", nullable = false, length = 24)
  public String status = "OPEN";

  @Column(name = "response", nullable = true, length = 2000)
  public String response;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt = Instant.now();

  @Column(name = "updated_at", nullable = false)
  public Instant updatedAt = Instant.now();
}
