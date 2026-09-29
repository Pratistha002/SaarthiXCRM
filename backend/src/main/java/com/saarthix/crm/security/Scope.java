package com.saarthix.crm.security;

import com.saarthix.crm.model.User;
import com.saarthix.crm.domain.Catalog;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class Scope {
    private final CurrentUser current;

    public Scope(CurrentUser current) {
        this.current = current;
    }

    public User user() {
        return current.get();
    }

    public String id() {
        return user().getId();
    }

    public boolean isPlatformAdmin() {
        return user().isPlatformAdmin();
    }

    public boolean isHeadOfSales() {
        return Catalog.isHeadOfSales(user().getRole());
    }

    /** Head of Sales sees the whole workspace. Platform admin sees every team. */
    public boolean seesTeamData() {
        return isPlatformAdmin() || isHeadOfSales();
    }

    public boolean assignedOnly() {
        return !seesTeamData();
    }

    public String workspaceId() {
        String workspaceId = user().getWorkspaceId();
        if (workspaceId == null || workspaceId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Your account is not in a workspace yet");
        }
        return workspaceId;
    }

    public User requireAdmin() {
        User user = user();
        if (!isHeadOfSales() && !user.isPlatformAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only Head of Sales can add or remove teammates");
        }
        return user;
    }

    public User requirePlatformAdmin() {
        User user = user();
        if (!user.isPlatformAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only a platform admin can view all teams");
        }
        return user;
    }

    public boolean sameWorkspace(String workspaceId) {
        if (isPlatformAdmin()) {
            return workspaceId != null && !workspaceId.isBlank();
        }
        return workspaceId != null && workspaceId.equals(workspaceId());
    }

    /**
     * Sales executives only see records assigned to them. Head of Sales sees the workspace.
     * Platform admin sees Head of Sales and Sales Executive data across every team.
     */
    public boolean canSee(String workspaceId, String ownerId) {
        if (isPlatformAdmin()) {
            return true;
        }
        if (!sameWorkspace(workspaceId)) {
            return false;
        }
        if (isHeadOfSales()) {
            return true;
        }
        return ownerId != null && ownerId.equals(id());
    }

    public boolean canSeeTask(String workspaceId, String ownerId, String assigneeId) {
        if (canSee(workspaceId, ownerId)) {
            return true;
        }
        return assigneeId != null && assigneeId.equals(id()) && sameWorkspace(workspaceId);
    }
}
