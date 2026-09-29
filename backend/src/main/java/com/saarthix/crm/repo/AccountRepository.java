package com.saarthix.crm.repo;

import com.saarthix.crm.model.Account;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface AccountRepository extends MongoRepository<Account, String> {
    List<Account> findByWorkspaceId(String workspaceId);
    Optional<Account> findFirstByWorkspaceIdAndNameKey(String workspaceId, String nameKey);
}
