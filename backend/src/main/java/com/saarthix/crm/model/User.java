package com.saarthix.crm.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "users")
public class User {
    @Id
    private String id;
    private String name;
    @Indexed(unique = true)
    private String email;
    private String passwordHash;
    private String company;
    @Indexed
    private String workspaceId;
    private String role;
    private String title;
    private Instant createdAt;
    private Instant lastLoginAt;
    private int loginCount;
    private boolean platformAdmin;
}
