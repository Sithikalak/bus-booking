package com.citylink.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "resource_mutex")
public class ResourceMutex {

  @Id
  public Long id;
}
