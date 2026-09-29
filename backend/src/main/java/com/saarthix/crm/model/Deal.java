package com.saarthix.crm.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

@Data
@Document(collection = "deals")
public class Deal {
    @Id
    private String id;
    @Indexed
    private String workspaceId;
    private String name;
    @Indexed
    private String accountId;
    private String accountName;
    private String primaryContactId;
    private String primaryContactName;
    private String ownerId;
    @Indexed
    private String leadId;
    private String product;
    private long value;
    private String currency = "INR";
    private String stage;
    private int probability;
    private String priority;
    private String expectedCloseDate;
    /** Open, Won or Lost. */
    private String status;
    private String lostReason;
    private String lostReasonOther;
    private String wonDate;
    /** Day the deal was won or lost (yyyy-MM-dd); used for "won this month" style reporting. */
    private String closedDate;
    private Instant closedAt;
    private String createdBy;
    private String createdByName;
    private Instant createdAt;
    private Instant updatedAt;

    @Transient
    private String ownerName;
    @Transient
    private Long weightedValue;
    /** Earliest open follow-up on this deal: type, title, dueDate, dueTime, dueAt. */
    @Transient
    private Map<String, Object> nextAction;
}
