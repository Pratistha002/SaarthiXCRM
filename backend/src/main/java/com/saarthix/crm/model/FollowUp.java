package com.saarthix.crm.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "followups")
public class FollowUp {
    @Id
    private String id;
    @Indexed
    private String workspaceId;
    private String ownerId;
    private String title;
    private String details;
    private String dueDate;
    private String priority;
    private String status;
    private String leadId;
    private String leadName;
    private String assigneeId;
    private String assigneeName;
    private String remindedOn;
    private Instant createdAt;
}
