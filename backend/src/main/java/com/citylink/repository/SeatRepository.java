package com.citylink.repository;

import com.citylink.entity.Seat;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface SeatRepository extends JpaRepository<Seat, Long> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from Seat e where e.id = :id")
  Optional<Seat> lockById(@Param("id") Long id);

  List<Seat> findByBusIdOrderByRowNumberAscColumnNumberAsc(Long busId);
}
