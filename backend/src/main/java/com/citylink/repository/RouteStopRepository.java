package com.citylink.repository;

import com.citylink.entity.RouteStop;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface RouteStopRepository extends JpaRepository<RouteStop, Long> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from RouteStop e where e.id = :id")
  Optional<RouteStop> lockById(@Param("id") Long id);

  List<RouteStop> findByRouteIdOrderByStopOrder(Long routeId);
  void deleteByRouteId(Long routeId);
}
