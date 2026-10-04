package com.citylink.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "notifications")
public class Notification {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "recipient_id", nullable = false)
  public UserAccount recipient;

  @Column(name = "type", nullable = false, length = 40)
  public String type;

  @Column(name = "title", nullable = false, length = 160)
  public String title;

  @Column(name = "message", nullable = false, length = 2000)
  public String message;

  @Column(name = "is_read", nullable = false)
  public boolean isRead = false;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt = Instant.now();
}
