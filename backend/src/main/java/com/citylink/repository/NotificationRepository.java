package com.citylink.repository;

import com.citylink.entity.Notification;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository
  extends JpaRepository<Notification, Long>
{
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from Notification e where e.id = :id")
  Optional<Notification> lockById(@Param("id") Long id);

  List<Notification> findByRecipientIdOrderByIdDesc(Long id);

  @Query("select n from Notification n where n.recipient.id = :userId or upper(n.recipient.role) = upper(:role) order by n.id desc")
  List<Notification> findRelevantForUser(@Param("userId") Long userId, @Param("role") String role);
}
