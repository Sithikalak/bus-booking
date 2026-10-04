package com.citylink.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "payments")
public class Payment {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "booking_id", nullable = false)
  public Booking booking;

  @Column(name = "amount", nullable = false, precision = 12, scale = 2)
  public BigDecimal amount;

  @Column(name = "method", nullable = false, length = 32)
  public String method;

  @Column(name = "status", nullable = false, length = 32)
  public String status;

  @Column(name = "transaction_reference", nullable = false, length = 100)
  public String transactionReference;

  @Column(name = "idempotency_key", nullable = false, length = 80)
  public String idempotencyKey;

  @Column(name = "refund_failure", nullable = false)
  public boolean refundFailure = false;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt = Instant.now();
}
