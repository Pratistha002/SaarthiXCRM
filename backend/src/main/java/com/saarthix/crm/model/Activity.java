package com.saarthix.crm.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "activities")
public class Activity {
    @Id
    private String id;
    @Indexed
    private String workspaceId;
    @Indexed
    private String leadId;
    private String type;
    private String title;
    private String detail;
    private String actorId;
    private String actorName;
    private Instant createdAt;
    private CallLog call;
}
