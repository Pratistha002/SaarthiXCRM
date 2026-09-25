package com.saarthix.crm.security;

import com.saarthix.crm.model.User;
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

    public String workspaceId() {
        String workspaceId = user().getWorkspaceId();
        if (workspaceId == null || workspaceId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Your account is not in a workspace yet");
        }
        return workspaceId;
    }

    public User requireAdmin() {
        User user = user();
        if (!"ADMIN".equals(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only an admin can do that");
        }
        return user;
    }

    public boolean sameWorkspace(String workspaceId) {
        return workspaceId != null && workspaceId.equals(workspaceId());
    }
}
