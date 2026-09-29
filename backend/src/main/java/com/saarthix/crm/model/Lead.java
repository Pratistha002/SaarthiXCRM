package com.saarthix.crm.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

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
    private String leadType;
    private String contactPerson;
    private String collegeName;
    private String course;
    private String branch;
    private String salutation;
    private String firstName;
    private String lastName;
    private String title;
    private String company;
    private String email;
    private String phone;
    private String mobile;
    private String fax;
    private String website;
    private String industry;
    private Integer employees;
    private Long annualRevenue;
    private String rating;
    private String country;
    private String building;
    private String street;
    private String city;
    private String state;
    private String zip;
    private String latitude;
    private String longitude;
    private long value;
    private String stage;
    private String priority;
    private String source;
    private String notes;
    private List<String> tags = new ArrayList<>();
    private String convertedContactId;
    private String convertedAccountId;
    private String convertedDealId;
    private Instant convertedAt;
    private String closeReason;
    private String closeNote;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant closedAt;
    private Instant lastContactedAt;
    private Instant nextFollowUpAt;

    @Transient
    private Integer score;
    @Transient
    private Integer weight;
    @Transient
    private Long weightedValue;
}
