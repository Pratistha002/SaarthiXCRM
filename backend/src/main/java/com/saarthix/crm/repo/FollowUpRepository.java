package com.saarthix.crm.repo;

import com.saarthix.crm.model.FollowUp;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;

public interface FollowUpRepository extends MongoRepository<FollowUp, String> {
    List<FollowUp> findByRemindAtLessThanEqualAndReminderSentAtIsNullAndStatusNot(Instant at, String status);
    List<FollowUp> findByWorkspaceId(String workspaceId);
    List<FollowUp> findByWorkspaceIdAndLeadId(String workspaceId, String leadId);
    List<FollowUp> findByOwnerId(String ownerId);
    List<FollowUp> findByStatusNot(String status);
}
