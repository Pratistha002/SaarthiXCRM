package com.saarthix.crm.repo;

import com.saarthix.crm.model.Deal;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface DealRepository extends MongoRepository<Deal, String> {
    List<Deal> findByWorkspaceId(String workspaceId);
    List<Deal> findByWorkspaceIdAndAccountId(String workspaceId, String accountId);
    List<Deal> findByWorkspaceIdAndPrimaryContactId(String workspaceId, String contactId);
    Optional<Deal> findFirstByWorkspaceIdAndLeadId(String workspaceId, String leadId);
}
