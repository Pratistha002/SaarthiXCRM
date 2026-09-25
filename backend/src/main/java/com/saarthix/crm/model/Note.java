package com.saarthix.crm.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "notes")
public class Note {
    @Id
    private String id;
    @Indexed
    private String workspaceId;
    private String ownerId;
    private String authorName;
    private String body;
    private boolean pinned;
    private String linkedType;
    private String linkedId;
    private String linkedName;
    private Instant createdAt;
}
