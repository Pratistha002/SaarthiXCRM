package com.saarthix.crm.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "notifications")
public class AppNotification {
    @Id
    private String id;
    @Indexed
    private String userId;
    private String workspaceId;
    private String kind;
    private String title;
    private String body;
    private String link;
    private boolean read;
    private Instant createdAt;
}
