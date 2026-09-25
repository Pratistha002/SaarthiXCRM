package com.saarthix.crm.repo;

import com.saarthix.crm.model.AppNotification;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface NotificationRepository extends MongoRepository<AppNotification, String> {
    List<AppNotification> findTop40ByUserIdOrderByCreatedAtDesc(String userId);
}
