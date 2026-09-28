package com.saarthix.crm.repo;

import com.saarthix.crm.model.Activity;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ActivityRepository extends MongoRepository<Activity, String> {
    List<Activity> findByLeadIdOrderByCreatedAtDesc(String leadId);
    List<Activity> findByLeadIdAndTypeOrderByCreatedAtDesc(String leadId, String type);
    Optional<Activity> findFirstByLeadIdAndCallRequestId(String leadId, String requestId);
    List<Activity> findTop25ByWorkspaceIdOrderByCreatedAtDesc(String workspaceId);
    void deleteByLeadId(String leadId);
}
