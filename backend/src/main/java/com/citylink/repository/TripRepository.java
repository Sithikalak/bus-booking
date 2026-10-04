package com.citylink.repository;

import com.citylink.entity.Trip;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface TripRepository extends JpaRepository<Trip, Long> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from Trip e where e.id = :id")
  Optional<Trip> lockById(@Param("id") Long id);

  @Query(
    "select t from Trip t where t.status not in ('CANCELLED', 'ARRIVED', 'COMPLETED') and t.departure < :end and t.arrival > :start and (:exclude is null or t.id <> :exclude)"
  )
  List<Trip> overlapping(
    @Param("start") LocalDateTime start,
    @Param("end") LocalDateTime end,
    @Param("exclude") Long exclude
  );
}
