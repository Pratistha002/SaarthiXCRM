package com.saarthix.crm.domain;

import com.saarthix.crm.model.Lead;

import java.util.List;
import java.util.Map;

public class DuplicateLeadException extends RuntimeException {
    private final List<Map<String, Object>> duplicates;

    public DuplicateLeadException(List<Lead> matches) {
        super("A similar lead is already in this workspace");
        this.duplicates = matches.stream()
                .map(lead -> Map.<String, Object>of(
                        "id", lead.getId(),
                        "name", lead.getName() == null ? "" : lead.getName(),
                        "company", lead.getCompany() == null ? "" : lead.getCompany(),
                        "email", lead.getEmail() == null ? "" : lead.getEmail(),
                        "ownerName", lead.getOwnerName() == null ? "" : lead.getOwnerName(),
                        "stage", lead.getStage() == null ? "" : lead.getStage()))
                .toList();
    }

    public List<Map<String, Object>> getDuplicates() {
        return duplicates;
    }
}
