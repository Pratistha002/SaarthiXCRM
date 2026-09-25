package com.saarthix.crm.repo;

import com.saarthix.crm.model.Workspace;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface WorkspaceRepository extends MongoRepository<Workspace, String> {
    Optional<Workspace> findByInviteCodeIgnoreCase(String inviteCode);
}
