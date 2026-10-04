package com.citylink.service;

import com.citylink.entity.*;
import java.util.*;

public interface GpsProvider {
  record Position(
    double latitude,
    double longitude,
    double speed,
    double progress
  ) {}

  Optional<Position> position(Trip trip, List<RouteStop> stops);
}
