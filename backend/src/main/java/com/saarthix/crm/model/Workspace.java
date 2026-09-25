package com.saarthix.crm.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "workspaces")
public class Workspace {
    @Id
    private String id;
    private String name;
    @Indexed(unique = true)
    private String inviteCode;
    private Instant createdAt;
}
