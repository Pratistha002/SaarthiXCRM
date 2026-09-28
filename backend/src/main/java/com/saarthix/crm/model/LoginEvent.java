package com.saarthix.crm.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "login_events")
public class LoginEvent {
    @Id
    private String id;
    private String userId;
    private String name;
    private String email;
    private String workspaceId;
    private String workspaceName;
    private Instant createdAt;
}
