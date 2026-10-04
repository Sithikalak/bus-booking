package com.citylink.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "refunds")
public class Refund {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "booking_id", nullable = false)
  public Booking booking;

  @Column(name = "reason", nullable = false, length = 2000)
  public String reason;

  @Column(name = "amount", nullable = false, precision = 12, scale = 2)
  public BigDecimal amount;

  @Column(name = "status", nullable = false, length = 32)
  public String status;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "reviewed_by_id", nullable = true)
  public UserAccount reviewedBy;

  @Column(name = "rejection_reason", nullable = true, length = 2000)
  public String rejectionReason;

  @Column(name = "attempts", nullable = false)
  public int attempts = 0;

  @Column(name = "gateway_reference", nullable = true, length = 100)
  public String gatewayReference;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt = Instant.now();

  @Column(name = "updated_at", nullable = false)
  public Instant updatedAt = Instant.now();
}
