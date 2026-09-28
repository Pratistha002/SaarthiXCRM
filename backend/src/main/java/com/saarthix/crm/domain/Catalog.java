package com.saarthix.crm.domain;

import java.util.List;
import java.util.Map;
import java.util.Set;

public final class Catalog {
    public static final List<String> STAGES = List.of("New", "Qualified", "Proposal", "Won", "Lost");
    public static final List<String> PRIORITIES = List.of("High", "Medium", "Low");
    public static final List<String> SOURCES = List.of(
            "Cold Outreach", "Event", "Social", "Website", "Other", "Referral");
    public static final List<String> TASK_STATUSES = List.of("Pending", "In Progress", "Completed");
    public static final List<String> PURPOSES = List.of(
            "Follow-up", "Introduction", "Proposal", "Check-in", "Closing");
    public static final List<String> TONES = List.of("Formal", "Friendly", "Concise", "Persuasive");
    public static final String HEAD_OF_SALES = "HEAD_OF_SALES";
    public static final String SALES_EXECUTIVE = "SALES_EXECUTIVE";
    public static final List<String> ROLES = List.of(HEAD_OF_SALES, SALES_EXECUTIVE);
    public static final List<String> WON_REASONS = List.of(
            "Price", "Product fit", "Relationship", "Speed", "Referral", "Other");
    public static final List<String> LOST_REASONS = List.of(
            "Price", "Competitor", "Timing", "No sponsor", "No budget", "Other");
    public static final Map<String, Integer> WEIGHTS = Map.of(
            "New", 15,
            "Qualified", 40,
            "Proposal", 70,
            "Won", 100,
            "Lost", 0);

    private Catalog() {
    }

    public static void require(String value, List<String> allowed, String label) {
        if (value == null || !allowed.contains(value)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    label + " must be one of: " + String.join(", ", allowed));
        }
    }

    public static String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return SALES_EXECUTIVE;
        }
        String value = role.trim();
        if (HEAD_OF_SALES.equals(value) || "ADMIN".equals(value) || "MANAGER".equals(value)
                || value.equalsIgnoreCase("Head of Sales")) {
            return HEAD_OF_SALES;
        }
        return SALES_EXECUTIVE;
    }

    public static String requireUserRole(String role) {
        if (role == null || role.isBlank()) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Choose Sales Executive or Head of Sales");
        }
        String value = role.trim();
        if (HEAD_OF_SALES.equals(value) || "ADMIN".equals(value) || "MANAGER".equals(value)
                || value.equalsIgnoreCase("Head of Sales")) {
            return HEAD_OF_SALES;
        }
        if (SALES_EXECUTIVE.equals(value) || "REP".equals(value)
                || value.equalsIgnoreCase("Sales Executive")) {
            return SALES_EXECUTIVE;
        }
        throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "Role must be Head of Sales or Sales Executive");
    }

    public static boolean isHeadOfSales(String role) {
        return HEAD_OF_SALES.equals(normalizeRole(role));
    }

    public static boolean isOpen(String stage) {
        return !Set.of("Won", "Lost").contains(stage);
    }

    public static int weight(String stage) {
        return WEIGHTS.getOrDefault(stage, 0);
    }

    public static long weighted(long value, String stage) {
        return Math.round(value * (weight(stage) / 100.0));
    }
}
