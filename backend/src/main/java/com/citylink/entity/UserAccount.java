package com.citylink.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "users")
public class UserAccount {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "first_name", nullable = false, length = 80)
  public String firstName;

  @Column(name = "last_name", nullable = false, length = 80)
  public String lastName;

  @Column(name = "email", nullable = false, length = 190)
  public String email;

  @Column(name = "phone", nullable = false, length = 24)
  public String phone;

  @Column(name = "password_hash", nullable = false, length = 100)
  public String passwordHash;

  @Column(name = "role", nullable = false, length = 32)
  public String role;

  @Column(name = "status", nullable = false, length = 32)
  public String status;

  @Column(name = "verified", nullable = false)
  public boolean verified = false;

  @Column(name = "permissions", nullable = false, length = 500)
  public String permissions = "";

  @Column(name = "token_version", nullable = false)
  public int tokenVersion = 0;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt = Instant.now();

  @Column(name = "updated_at", nullable = false)
  public Instant updatedAt = Instant.now();
}
