package com.citylink.repository;

import com.citylink.entity.Staff;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface StaffRepository extends JpaRepository<Staff, Long> {

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select s from Staff s where s.id = :id")
  Optional<Staff> lockById(@Param("id") Long id);

  Optional<Staff> findByEmailIgnoreCase(String email);

  Optional<Staff> findByEmployeeId(String employeeId);

  List<Staff> findByRole(String role);

  List<Staff> findByRoleAndAvailableTrue(String role);
}
