package com.saarthix.crm.repo;

import com.saarthix.crm.model.Attachment;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface AttachmentRepository extends MongoRepository<Attachment, String> {
    List<Attachment> findByLeadIdOrderByCreatedAtDesc(String leadId);
    List<Attachment> findByDealIdOrderByCreatedAtDesc(String dealId);
    void deleteByLeadId(String leadId);
}
