package com.citylink.repository;

import com.citylink.entity.ResourceMutex;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;

public interface ResourceMutexRepository
  extends JpaRepository<ResourceMutex, Long>
{
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select m from ResourceMutex m where m.id=1")
  ResourceMutex lock();
}
