package com.citylink.repository;

import com.citylink.entity.Booking;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface BookingRepository extends JpaRepository<Booking, Long> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from Booking e where e.id = :id")
  Optional<Booking> lockById(@Param("id") Long id);

  List<Booking> findByPassengerIdOrderByIdDesc(Long id);
  List<Booking> findByTripIdAndStatus(Long tripId, String status);
  List<Booking> findByTripIdOrderByIdAsc(Long tripId);
  Optional<Booking> findByReference(String reference);
  boolean existsByPassengerIdAndTripIdAndStatus(
    Long passengerId,
    Long tripId,
    String status
  );
}
