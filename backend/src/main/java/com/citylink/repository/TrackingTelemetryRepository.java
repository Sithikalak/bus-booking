package com.citylink.repository;

import com.citylink.entity.TrackingTelemetry;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TrackingTelemetryRepository extends JpaRepository<TrackingTelemetry, Long> {
  Optional<TrackingTelemetry> findByTrackingId(Long trackingId);
}
