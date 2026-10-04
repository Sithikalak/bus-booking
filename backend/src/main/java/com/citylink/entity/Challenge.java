package com.citylink.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "challenges")
public class Challenge {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "public_id", nullable = false, length = 64)
  public String publicId;

  @Column(name = "email", nullable = false, length = 190)
  public String email;

  @Column(name = "purpose", nullable = false, length = 24)
  public String purpose;

  @Column(name = "code_hash", nullable = false, length = 100)
  public String codeHash;

  @Column(name = "expires_at", nullable = false)
  public Instant expiresAt;

  @Column(name = "attempts", nullable = false)
  public int attempts = 0;

  @Column(name = "resend_after", nullable = false)
  public Instant resendAfter;

  @Column(name = "first_name", nullable = true, length = 80)
  public String firstName;

  @Column(name = "last_name", nullable = true, length = 80)
  public String lastName;

  @Column(name = "phone", nullable = true, length = 24)
  public String phone;

  @Column(name = "password_hash", nullable = true, length = 100)
  public String passwordHash;

  @Column(name = "role", nullable = true, length = 32)
  public String role;

  @Column(name = "used", nullable = false)
  public boolean used = false;
}
