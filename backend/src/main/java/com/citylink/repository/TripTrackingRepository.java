package com.citylink.repository;

import com.citylink.entity.TripTracking;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TripTrackingRepository extends JpaRepository<TripTracking, Long> {
  Optional<TripTracking> findByTripId(Long tripId);
}
