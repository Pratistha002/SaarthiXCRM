package com.saarthix.crm.repo;

import com.saarthix.crm.model.MeetingLog;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface MeetingLogRepository extends MongoRepository<MeetingLog, String> {
    List<MeetingLog> findByWorkspaceId(String workspaceId);
    Optional<MeetingLog> findFirstByFollowUpId(String followUpId);
    List<MeetingLog> findByWorkspaceIdAndLeadIdOrderByCreatedAtDesc(String workspaceId, String leadId);
    List<MeetingLog> findByWorkspaceIdAndDealIdOrderByCreatedAtDesc(String workspaceId, String dealId);
}
