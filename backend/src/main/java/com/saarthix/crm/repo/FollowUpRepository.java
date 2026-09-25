package com.saarthix.crm.repo;

import com.saarthix.crm.model.FollowUp;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface FollowUpRepository extends MongoRepository<FollowUp, String> {
    List<FollowUp> findByWorkspaceId(String workspaceId);
    List<FollowUp> findByOwnerId(String ownerId);
    List<FollowUp> findByStatusNot(String status);
}
