package com.citylink.repository;

import com.citylink.entity.Refund;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface RefundRepository extends JpaRepository<Refund, Long> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from Refund e where e.id = :id")
  Optional<Refund> lockById(@Param("id") Long id);

  Optional<Refund> findByBookingId(Long bookingId);
}
