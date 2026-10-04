package com.citylink.repository;

import com.citylink.entity.SupportRequest;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface SupportRequestRepository
  extends JpaRepository<SupportRequest, Long>
{
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from SupportRequest e where e.id = :id")
  Optional<SupportRequest> lockById(@Param("id") Long id);

  List<SupportRequest> findByPassengerIdOrderByIdDesc(Long id);
}
