package com.saarthix.crm.domain;

import java.util.List;
import java.util.Map;
import java.util.Set;

public final class Catalog {
    public static final String CONVERTED = "Converted";
    public static final List<String> FUNNEL = List.of(
            "New", "Attempted Contact", "Contacted", "Interested", "Qualified", CONVERTED);
    public static final List<String> EXITS = List.of("Junk", "Not Interested", "Lost");
    public static final List<String> STAGES = java.util.stream.Stream.concat(FUNNEL.stream(), EXITS.stream()).toList();
    public static final List<String> PRIORITIES = List.of("High", "Medium", "Low");
    public static final List<String> LEAD_TYPES = List.of("Student", "Institute", "Industry");
    public static final List<String> SOURCES = List.of(
            "Cold Outreach", "Event", "Social", "Website", "Other", "Referral");
    public static final List<String> TASK_STATUSES = List.of("Pending", "In Progress", "Approved", "Completed");
    public static final String PENDING_APPROVAL = "Pending Approval";
    public static final String APPROVED = "Approved";
    public static final List<String> PURPOSES = List.of(
            "Follow-up", "Introduction", "Proposal", "Check-in", "Closing");
    public static final List<String> TONES = List.of("Formal", "Friendly", "Concise", "Persuasive");
    public static final String HEAD_OF_SALES = "HEAD_OF_SALES";
    public static final String SALES_EXECUTIVE = "SALES_EXECUTIVE";
    public static final List<String> ROLES = List.of(HEAD_OF_SALES, SALES_EXECUTIVE);
    public static final List<String> WON_REASONS = List.of(
            "Price", "Product fit", "Relationship", "Speed", "Referral", "Other");
    public static final List<String> JUNK_REASONS = List.of(
            "Invalid contact details", "Duplicate", "Spam / fake", "Test entry", "Other");
    public static final List<String> NOT_INTERESTED_REASONS = List.of(
            "No requirement", "Too expensive", "Chose another option", "Bad timing", "Other");
    public static final List<String> LOST_REASONS = List.of(
            "Price", "Competitor", "Timing", "No response", "No budget", "Other");
    public static final List<String> EXIT_REASONS = java.util.stream.Stream
            .of(JUNK_REASONS, NOT_INTERESTED_REASONS, LOST_REASONS)
            .flatMap(List::stream).distinct().toList();
    public static final Map<String, Integer> WEIGHTS = Map.of(
            "New", 5,
            "Attempted Contact", 10,
            "Contacted", 20,
            "Interested", 40,
            "Qualified", 60,
            CONVERTED, 100,
            "Junk", 0,
            "Not Interested", 0,
            "Lost", 0);
    public static final String DEAL_WON = "Won";
    public static final String DEAL_LOST = "Lost";
    public static final List<String> DEAL_ACTIVE_STAGES = List.of("Qualified", "Demo / Meeting", "Proposal", "Negotiation");
    public static final List<String> DEAL_STAGES = List.of(
            "Qualified", "Demo / Meeting", "Proposal", "Negotiation", DEAL_WON, DEAL_LOST);
    /** Default win probability per deal stage. Deals store their own copy so this can become per-workspace later. */
    public static final Map<String, Integer> DEAL_PROBABILITY = Map.of(
            "Qualified", 20,
            "Demo / Meeting", 40,
            "Proposal", 60,
            "Negotiation", 80,
            DEAL_WON, 100,
            DEAL_LOST, 0);
    public static final List<String> DEAL_LOST_REASONS = List.of(
            "Price", "Competitor", "No Budget", "Timing", "Not Interested", "No Response", "Requirement Changed", "Other");
    public static final List<String> PRODUCTS = List.of("TalentX");

    public static String dealStatus(String stage) {
        if (DEAL_WON.equals(stage)) return DEAL_WON;
        if (DEAL_LOST.equals(stage)) return DEAL_LOST;
        return "Open";
    }

    public static final String CONNECTED = "Connected";
    public static final List<String> CALL_OUTCOMES = List.of(
            CONNECTED, "No Answer", "Busy", "Wrong Number", "Call Back Later");
    public static final List<String> CALL_RESPONSES = List.of(
            "Interested", "Not Interested", "Needs More Information", "Wants Demo", "Wants Proposal",
            "Call Back Later", "Other");
    public static final String NO_FURTHER_ACTION = "No Further Action";
    public static final List<String> TASK_TYPES = List.of(
            "Call", "Follow-up", "Meeting", "Demo", "Send Proposal", "Email", "WhatsApp");
    public static final Map<String, Integer> REMINDER_MINUTES = Map.of(
            "None", 0,
            "15 minutes before", 15,
            "1 hour before", 60,
            "1 day before", 1440);
    public static final Map<String, String> LEGACY_STAGES = Map.of(
            "Proposal", "Interested",
            "Won", CONVERTED);

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
        return !isWon(stage) && !isExit(stage);
    }

    public static boolean isWon(String stage) {
        return CONVERTED.equals(stage);
    }

    public static boolean isExit(String stage) {
        return EXITS.contains(stage);
    }

    public static boolean isPendingApproval(String approvalStatus) {
        return PENDING_APPROVAL.equals(approvalStatus);
    }

    public static boolean isApproved(String approvalStatus) {
        return approvalStatus == null || approvalStatus.isBlank() || APPROVED.equals(approvalStatus);
    }

    public static List<String> reasonsFor(String stage) {
        if (stage == null) return List.of();
        return switch (stage) {
            case CONVERTED -> WON_REASONS;
            case "Junk" -> JUNK_REASONS;
            case "Not Interested" -> NOT_INTERESTED_REASONS;
            case "Lost" -> LOST_REASONS;
            default -> List.of();
        };
    }

    public static int weight(String stage) {
        return WEIGHTS.getOrDefault(stage, 0);
    }

    public static long weighted(long value, String stage) {
        return Math.round(value * (weight(stage) / 100.0));
    }
}
