package com.saarthix.crm.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "accounts")
public class Account {
    @Id
    private String id;
    @Indexed
    private String workspaceId;
    private String name;
    /** Lower-cased, trimmed name used to avoid creating the same organisation twice. */
    @Indexed
    private String nameKey;
    private String type;
    private String website;
    private String phone;
    private String industry;
    private String city;
    private String state;
    private String country;
    private String ownerId;
    private Instant createdAt;
    private Instant updatedAt;
}
