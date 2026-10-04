package com.citylink.repository;

import com.citylink.entity.Bus;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface BusRepository extends JpaRepository<Bus, Long> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from Bus e where e.id = :id")
  Optional<Bus> lockById(@Param("id") Long id);
}
