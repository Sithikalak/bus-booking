package com.citylink.repository;

import com.citylink.entity.Route;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface RouteRepository extends JpaRepository<Route, Long> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from Route e where e.id = :id")
  Optional<Route> lockById(@Param("id") Long id);
}
