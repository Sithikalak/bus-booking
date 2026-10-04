package com.citylink.repository;

import com.citylink.entity.UserAccount;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface UserAccountRepository
  extends JpaRepository<UserAccount, Long>
{
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from UserAccount e where e.id = :id")
  Optional<UserAccount> lockById(@Param("id") Long id);

  Optional<UserAccount> findByEmailIgnoreCase(String email);
  List<UserAccount> findByRole(String role);
}
