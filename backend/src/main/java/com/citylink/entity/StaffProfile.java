package com.citylink.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "staff_profiles")
public class StaffProfile {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "user_id", nullable = false)
  public UserAccount user;

  @Column(name = "license_number", nullable = true, length = 60)
  public String licenseNumber;

  @Column(name = "available", nullable = false)
  public boolean available = true;
}
