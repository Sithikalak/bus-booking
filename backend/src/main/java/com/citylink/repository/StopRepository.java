package com.citylink.repository;

import com.citylink.entity.Stop;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface StopRepository extends JpaRepository<Stop, Long> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from Stop e where e.id = :id")
  Optional<Stop> lockById(@Param("id") Long id);
}
