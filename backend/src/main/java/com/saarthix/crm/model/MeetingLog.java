package com.saarthix.crm.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "meeting_logs")
public class MeetingLog {
    @Id
    private String id;
    @Indexed
    private String workspaceId;
    private String ownerId;
    @Indexed
    private String followUpId;
    private String type;
    private String title;
    private String leadId;
    private String leadName;
    private String dealId;
    private String dealName;
    private String meetingDate;
    private String meetingTime;
    private String attendees;
    private String topicsDiscussed;
    private String requirements;
    private String feedback;
    private String interestLevel;
    private String decisions;
    private String followUpAction;
    private String nextFollowUpDate;
    private String createdById;
    private String createdByName;
    private Instant createdAt;
    private Instant updatedAt;
}
