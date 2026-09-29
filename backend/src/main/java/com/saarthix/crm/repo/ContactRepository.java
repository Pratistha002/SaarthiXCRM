package com.saarthix.crm.repo;

import com.saarthix.crm.model.Contact;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ContactRepository extends MongoRepository<Contact, String> {
    List<Contact> findByWorkspaceId(String workspaceId);
    List<Contact> findByOwnerId(String ownerId);
    List<Contact> findByWorkspaceIdAndAccountId(String workspaceId, String accountId);
}
