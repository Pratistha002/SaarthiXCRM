package com.saarthix.crm.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "leads")
public class Lead {
    @Id
    private String id;
    @Indexed
    private String workspaceId;
    @Indexed
    private String ownerId;
    private String ownerName;
    private String name;
    private String company;
    private String email;
    private String phone;
    private long value;
    private String stage;
    private String priority;
    private String source;
    private String notes;
    private String closeReason;
    private String closeNote;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant closedAt;

    @Transient
    private Integer score;
    @Transient
    private Integer weight;
    @Transient
    private Long weightedValue;
}
