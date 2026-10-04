package com.citylink.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "staff")
public class Staff {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "employee_id", nullable = false, length = 40, unique = true)
  public String employeeId;

  @Column(name = "first_name", nullable = false, length = 80)
  public String firstName;

  @Column(name = "last_name", nullable = false, length = 80)
  public String lastName;

  @Column(name = "email", nullable = false, length = 190, unique = true)
  public String email;

  @Column(name = "phone", nullable = false, length = 24)
  public String phone;

  @Column(name = "nic", nullable = false, length = 24)
  public String nic;

  @Column(name = "role", nullable = false, length = 32)
  public String role;

  @Column(name = "department", nullable = false, length = 60)
  public String department;

  @Column(name = "license_number", length = 60)
  public String licenseNumber;

  @Column(name = "status", nullable = false, length = 32)
  public String status = "ACTIVE";

  @Column(name = "available", nullable = false)
  public boolean available = true;

  @Column(name = "password_hash", nullable = false, length = 100)
  public String passwordHash;

  @Column(name = "permissions", nullable = false, length = 500)
  public String permissions = "";

  @Column(name = "token_version", nullable = false)
  public int tokenVersion = 0;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt = Instant.now();

  @Column(name = "updated_at", nullable = false)
  public Instant updatedAt = Instant.now();
}
