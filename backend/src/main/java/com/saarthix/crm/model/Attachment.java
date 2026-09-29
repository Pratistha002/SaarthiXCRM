package com.saarthix.crm.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "attachments")
public class Attachment {
    @Id
    private String id;
    @Indexed
    private String workspaceId;
    @Indexed
    private String leadId;
    @Indexed
    private String dealId;
    private String fileName;
    private String contentType;
    private long size;
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String data;
    private String uploadedBy;
    private Instant createdAt;
}
