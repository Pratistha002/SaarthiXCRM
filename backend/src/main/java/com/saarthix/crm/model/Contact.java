package com.saarthix.crm.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Document(collection = "contacts")
public class Contact {
    @Id
    private String id;
    @Indexed
    private String workspaceId;
    private String ownerId;
    private String name;
    private String title;
    private String company;
    private String email;
    private String phone;
    private List<String> tags = new ArrayList<>();
    private boolean favorite;
    private Instant createdAt;
}
