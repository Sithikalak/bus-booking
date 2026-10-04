package com.citylink.repository;

import com.citylink.entity.TripSeat;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface TripSeatRepository extends JpaRepository<TripSeat, Long> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from TripSeat e where e.id = :id")
  Optional<TripSeat> lockById(@Param("id") Long id);

  List<TripSeat> findByTripIdOrderById(Long tripId);
  Optional<TripSeat> findByHoldToken(String token);
  Optional<TripSeat> findByTripIdAndSeatId(Long tripId, Long seatId);
  List<TripSeat> findByStatusAndExpiresAtBefore(String status, Instant instant);
  void deleteByTripId(Long tripId);
}
