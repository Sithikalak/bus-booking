package com.citylink.repository;

import com.citylink.entity.Challenge;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface ChallengeRepository extends JpaRepository<Challenge, Long> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from Challenge e where e.id = :id")
  Optional<Challenge> lockById(@Param("id") Long id);

  Optional<Challenge> findByPublicId(String publicId);
  Optional<Challenge> findFirstByEmailAndPurposeOrderByIdDesc(
    String email,
    String purpose
  );
}
