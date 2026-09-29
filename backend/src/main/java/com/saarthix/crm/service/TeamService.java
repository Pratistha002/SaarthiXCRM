package com.saarthix.crm.service;

import com.saarthix.crm.domain.Catalog;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.model.User;
import com.saarthix.crm.model.Workspace;
import com.saarthix.crm.repo.LeadRepository;
import com.saarthix.crm.repo.UserRepository;
import com.saarthix.crm.repo.WorkspaceRepository;
import com.saarthix.crm.security.Scope;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class TeamService {
    private final UserRepository users;
    private final WorkspaceRepository workspaces;
    private final LeadRepository leads;
    private final PasswordEncoder encoder;
    private final NotificationService notifications;
    private final Scope scope;

    public TeamService(UserRepository users, WorkspaceRepository workspaces, LeadRepository leads,
                       PasswordEncoder encoder, NotificationService notifications, Scope scope) {
        this.users = users;
        this.workspaces = workspaces;
        this.leads = leads;
        this.encoder = encoder;
        this.notifications = notifications;
        this.scope = scope;
    }

    public Map<String, Object> overview() {
        User me = scope.user();
        boolean allTeams = scope.isPlatformAdmin();
        Workspace workspace = workspaces.findById(me.getWorkspaceId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace not found"));
        List<Lead> all = allTeams ? leads.findAll() : leads.findByWorkspaceId(me.getWorkspaceId());
        List<User> people = allTeams ? users.findAll() : users.findByWorkspaceId(me.getWorkspaceId());
        boolean hideOthers = scope.assignedOnly();
        List<Map<String, Object>> members = new ArrayList<>();
        for (User user : people) {
            boolean isYou = user.getId().equals(me.getId());
            List<Lead> owned = all.stream().filter(l -> user.getId().equals(l.getOwnerId())).toList();
            long open = hideOthers && !isYou ? 0 : owned.stream().filter(l -> Catalog.isOpen(l.getStage())).mapToLong(Lead::getValue).sum();
            long won = hideOthers && !isYou ? 0 : owned.stream().filter(l -> Catalog.isWon(l.getStage())).mapToLong(Lead::getValue).sum();
            long wonCount = hideOthers && !isYou ? 0 : owned.stream().filter(l -> Catalog.isWon(l.getStage())).count();
            long lostCount = hideOthers && !isYou ? 0 : owned.stream().filter(l -> Catalog.isExit(l.getStage())).count();
            long decided = wonCount + lostCount;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", user.getId());
            row.put("name", user.getName());
            row.put("email", user.getEmail());
            row.put("role", Catalog.normalizeRole(user.getRole()));
            row.put("title", user.getTitle() == null ? "" : user.getTitle());
            row.put("leads", hideOthers && !isYou ? null : owned.size());
            row.put("openValue", hideOthers && !isYou ? null : open);
            row.put("wonValue", hideOthers && !isYou ? null : won);
            row.put("winRate", hideOthers && !isYou ? null : (decided == 0 ? 0 : Math.round(wonCount * 100.0 / decided)));
            row.put("isYou", isYou);
            members.add(row);
        }
        members.sort(Comparator.comparing(row -> String.valueOf(row.get("name")), String.CASE_INSENSITIVE_ORDER));
        long unassigned = hideOthers ? 0 : all.stream().filter(l -> l.getOwnerId() == null || l.getOwnerId().isBlank()).count();
        return Map.of(
                "workspace", Map.of("id", workspace.getId(), "name", workspace.getName(), "inviteCode", workspace.getInviteCode()),
                "members", members,
                "unassigned", unassigned,
                "youAreAdmin", Catalog.isHeadOfSales(me.getRole()) || me.isPlatformAdmin());
    }

    public Map<String, Object> addMember(MemberRequest request) {
        User admin = scope.requireAdmin();
        String role = Catalog.requireUserRole(request.role());
        String email = request.email().trim().toLowerCase();
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Someone already uses that email");
        }
        User user = new User();
        user.setName(request.name().trim());
        user.setEmail(email);
        user.setPasswordHash(encoder.encode(request.password()));
        user.setWorkspaceId(admin.getWorkspaceId());
        user.setRole(role);
        user.setTitle(request.title() == null ? "" : request.title().trim());
        user.setCreatedAt(Instant.now());
        users.save(user);
        notifications.push(user.getId(), user.getWorkspaceId(), "welcome",
                "Welcome to the team", admin.getName() + " added you to this workspace.", "/dashboard");
        return Map.of("id", user.getId(), "name", user.getName(), "email", user.getEmail(), "role", user.getRole());
    }

    public Map<String, Object> changeRole(String id, RoleRequest request) {
        User admin = scope.requireAdmin();
        String next = Catalog.requireUserRole(request.role());
        User member = member(id, admin.getWorkspaceId());
        if (member.getId().equals(admin.getId()) && !Catalog.isHeadOfSales(next) && headCount(admin.getWorkspaceId()) <= 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Promote another Head of Sales before changing your own role");
        }
        member.setRole(next);
        users.save(member);
        return Map.of("id", member.getId(), "role", member.getRole());
    }

    public Map<String, Object> removeMember(String id, String reassignTo) {
        User admin = scope.requireAdmin();
        User member = member(id, admin.getWorkspaceId());
        if (member.getId().equals(admin.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot remove yourself");
        }
        User target = reassignTo == null || reassignTo.isBlank() ? admin : member(reassignTo, admin.getWorkspaceId());
        List<Lead> owned = leads.findByWorkspaceIdAndOwnerId(admin.getWorkspaceId(), member.getId());
        owned.forEach(lead -> {
            lead.setOwnerId(target.getId());
            lead.setOwnerName(target.getName());
            leads.save(lead);
        });
        users.delete(member);
        return Map.of("removed", member.getName(), "reassigned", owned.size(), "to", target.getName());
    }

    private User member(String id, String workspaceId) {
        return users.findById(id)
                .filter(user -> workspaceId.equals(user.getWorkspaceId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Teammate not found"));
    }

    private long headCount(String workspaceId) {
        return users.findByWorkspaceId(workspaceId).stream()
                .filter(user -> Catalog.isHeadOfSales(user.getRole()))
                .count();
    }

    public record MemberRequest(
            @NotBlank(message = "Name is required") String name,
            @NotBlank(message = "Email is required") @Email(message = "Enter a valid email") String email,
            @NotBlank(message = "Password is required")
            @Size(min = 8, message = "Password must be at least 8 characters") String password,
            @NotBlank String role,
            String title) {
    }

    public record RoleRequest(@NotBlank String role) {
    }
}
