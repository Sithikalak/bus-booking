package com.citylink.service;

import com.citylink.entity.Trip;
import com.citylink.exception.BusinessException;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;

@Service
public class LockService {

  @PersistenceContext
  private EntityManager em;

  public Trip trip(Long id) {
    var t = em.find(Trip.class, id);
    if (t == null) throw new BusinessException(
      "NOT_FOUND",
      "Trip was not found.",
      404
    );
    em.refresh(t, LockModeType.PESSIMISTIC_WRITE);
    return t;
  }

  public <T> void refresh(T value) {
    em.refresh(value);
  }
}
