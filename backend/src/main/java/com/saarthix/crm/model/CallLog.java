package com.saarthix.crm.model;

import lombok.Data;

import java.time.Instant;

@Data
public class CallLog {
    private String requestId;
    private String phone;
    private String outcome;
    private String customerResponse;
    private String customerResponseOther;
    private String notes;
    /** Set only when the salesperson started the call from the CRM; never guessed. */
    private Instant startedAt;
    private Instant completedAt;
    /** Stays null until a telephony provider reports the real duration. */
    private Integer durationSeconds;
    private String nextAction;
    private String nextActionDate;
    private String nextActionTime;
    private Instant nextActionAt;
    private String followUpId;
    private String stageBefore;
    private String stageAfter;
}
