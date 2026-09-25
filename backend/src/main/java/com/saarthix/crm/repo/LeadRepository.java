package com.saarthix.crm.repo;

import com.saarthix.crm.model.Lead;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface LeadRepository extends MongoRepository<Lead, String> {
    List<Lead> findByWorkspaceId(String workspaceId);
    List<Lead> findByWorkspaceIdAndOwnerId(String workspaceId, String ownerId);
    long countByWorkspaceId(String workspaceId);
    long countByOwnerId(String ownerId);
}
