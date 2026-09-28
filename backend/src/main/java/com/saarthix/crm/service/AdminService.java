package com.saarthix.crm.service;

import com.saarthix.crm.model.LoginEvent;
import com.saarthix.crm.model.User;
import com.saarthix.crm.model.Workspace;
import com.saarthix.crm.repo.LoginEventRepository;
import com.saarthix.crm.repo.UserRepository;
import com.saarthix.crm.repo.WorkspaceRepository;
import com.saarthix.crm.security.Scope;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AdminService {
    private final UserRepository users;
    private final WorkspaceRepository workspaces;
    private final LoginEventRepository logins;
    private final Scope scope;

    public AdminService(UserRepository users, WorkspaceRepository workspaces, LoginEventRepository logins, Scope scope) {
        this.users = users;
        this.workspaces = workspaces;
        this.logins = logins;
        this.scope = scope;
    }

    public Map<String, Object> overview() {
        scope.requirePlatformAdmin();
        List<User> allUsers = users.findAll();
        List<Workspace> teams = workspaces.findAll();
        Instant dayAgo = Instant.now().minus(1, ChronoUnit.DAYS);

        List<Map<String, Object>> teamRows = new ArrayList<>();
        for (Workspace workspace : teams) {
            List<User> members = allUsers.stream()
                    .filter(user -> workspace.getId().equals(user.getWorkspaceId()))
                    .sorted(Comparator.comparing(User::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                    .toList();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", workspace.getId());
            row.put("name", workspace.getName());
            row.put("inviteCode", workspace.getInviteCode());
            row.put("createdAt", workspace.getCreatedAt());
            row.put("memberCount", members.size());
            row.put("members", members.stream().map(this::person).toList());
            teamRows.add(row);
        }
        teamRows.sort(Comparator.comparing(row -> String.valueOf(row.get("name")), String.CASE_INSENSITIVE_ORDER));

        List<Map<String, Object>> people = allUsers.stream()
                .sorted(Comparator.comparing(User::getLastLoginAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::person)
                .toList();

        List<Map<String, Object>> sessions = logins.findTop80ByOrderByCreatedAtDesc().stream().map(this::session).toList();
        long signedInToday = allUsers.stream()
                .filter(user -> user.getLastLoginAt() != null && user.getLastLoginAt().isAfter(dayAgo))
                .count();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("teamCount", teams.size());
        body.put("userCount", allUsers.size());
        body.put("signedInToday", signedInToday);
        body.put("sessionCount", sessions.size());
        body.put("teams", teamRows);
        body.put("people", people);
        body.put("sessions", sessions);
        return body;
    }

    private Map<String, Object> person(User user) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", user.getId());
        row.put("name", user.getName());
        row.put("email", user.getEmail());
        row.put("role", user.getRole() == null ? "REP" : user.getRole());
        row.put("title", user.getTitle() == null ? "" : user.getTitle());
        row.put("team", workspaces.findById(user.getWorkspaceId() == null ? "" : user.getWorkspaceId())
                .map(Workspace::getName).orElse("Unassigned"));
        row.put("lastLoginAt", user.getLastLoginAt());
        row.put("loginCount", user.getLoginCount());
        row.put("createdAt", user.getCreatedAt());
        row.put("platformAdmin", user.isPlatformAdmin());
        return row;
    }

    private Map<String, Object> session(LoginEvent event) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", event.getId());
        row.put("name", event.getName());
        row.put("email", event.getEmail());
        row.put("team", event.getWorkspaceName() == null ? "" : event.getWorkspaceName());
        row.put("at", event.getCreatedAt());
        return row;
    }
}
