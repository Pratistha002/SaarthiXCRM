package com.saarthix.crm.domain;

import com.saarthix.crm.model.Lead;

import java.time.Duration;
import java.time.Instant;

public final class LeadScore {
    private LeadScore() {
    }

    public static int of(Lead lead) {
        int score = 0;
        score += switch (lead.getPriority() == null ? "" : lead.getPriority()) {
            case "High" -> 30;
            case "Medium" -> 18;
            case "Low" -> 8;
            default -> 0;
        };
        score += switch (lead.getStage() == null ? "" : lead.getStage()) {
            case "Proposal" -> 25;
            case "Qualified" -> 18;
            case "Won" -> 22;
            case "New" -> 12;
            default -> 0;
        };
        score += (int) Math.min(25, lead.getValue() / 10_000);
        Instant updated = lead.getUpdatedAt() == null ? Instant.now() : lead.getUpdatedAt();
        long days = Duration.between(updated, Instant.now()).toDays();
        if (days <= 7) score += 15;
        else if (days <= 30) score += 8;
        else score += 3;
        if (lead.getEmail() != null && !lead.getEmail().isBlank()) score += 5;
        if (lead.getPhone() != null && !lead.getPhone().isBlank()) score += 3;
        return Math.min(100, score);
    }
}
