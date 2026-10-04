package com.citylink.repository;

import com.citylink.entity.StaffProfile;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface StaffProfileRepository
  extends JpaRepository<StaffProfile, Long>
{
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from StaffProfile e where e.id = :id")
  Optional<StaffProfile> lockById(@Param("id") Long id);

  Optional<StaffProfile> findByUserId(Long userId);
}
