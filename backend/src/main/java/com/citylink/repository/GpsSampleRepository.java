package com.citylink.repository;

import com.citylink.entity.GpsSample;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface GpsSampleRepository extends JpaRepository<GpsSample, Long> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from GpsSample e where e.id = :id")
  Optional<GpsSample> lockById(@Param("id") Long id);

  Optional<GpsSample> findFirstByTripIdOrderByRecordedAtDesc(Long tripId);
}
