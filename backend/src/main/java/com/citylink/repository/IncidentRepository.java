package com.citylink.repository;

import com.citylink.entity.Incident;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface IncidentRepository extends JpaRepository<Incident, Long> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from Incident e where e.id = :id")
  Optional<Incident> lockById(@Param("id") Long id);

  List<Incident> findByBusIdAndStatusNot(Long busId, String status);
}
