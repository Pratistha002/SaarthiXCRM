package com.saarthix.crm.repo;

import com.saarthix.crm.model.LoginEvent;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface LoginEventRepository extends MongoRepository<LoginEvent, String> {
    List<LoginEvent> findTop80ByOrderByCreatedAtDesc();
}
