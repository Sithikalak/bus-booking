package com.citylink.repository;

import com.citylink.entity.Payment;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from Payment e where e.id = :id")
  Optional<Payment> lockById(@Param("id") Long id);

  Optional<Payment> findByIdempotencyKey(String key);
  Optional<Payment> findFirstByBookingIdOrderByIdDesc(Long bookingId);
}
