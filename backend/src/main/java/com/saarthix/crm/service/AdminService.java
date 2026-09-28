package com.saarthix.crm.service;

import com.saarthix.crm.model.Contact;
import com.saarthix.crm.domain.Catalog;
import com.saarthix.crm.model.FollowUp;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.model.LoginEvent;
import com.saarthix.crm.model.Note;
import com.saarthix.crm.model.User;
import com.saarthix.crm.model.Workspace;
import com.saarthix.crm.repo.ContactRepository;
import com.saarthix.crm.repo.FollowUpRepository;
import com.saarthix.crm.repo.LeadRepository;
import com.saarthix.crm.repo.LoginEventRepository;
import com.saarthix.crm.repo.NoteRepository;
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
    private final LeadRepository leads;
    private final ContactRepository contacts;
    private final FollowUpRepository followUps;
    private final NoteRepository notes;
    private final Scope scope;

    public AdminService(UserRepository users, WorkspaceRepository workspaces, LoginEventRepository logins,
                        LeadRepository leads, ContactRepository contacts, FollowUpRepository followUps,
                        NoteRepository notes, Scope scope) {
        this.users = users;
        this.workspaces = workspaces;
        this.logins = logins;
        this.leads = leads;
        this.contacts = contacts;
        this.followUps = followUps;
        this.notes = notes;
        this.scope = scope;
    }

    public Map<String, Object> overview() {
        scope.requirePlatformAdmin();
        List<User> allUsers = users.findAll();
        List<Workspace> teams = workspaces.findAll();
        List<Lead> allLeads = leads.findAll();
        List<Contact> allContacts = contacts.findAll();
        List<FollowUp> allTasks = followUps.findAll();
        List<Note> allNotes = notes.findAll();
        Instant dayAgo = Instant.now().minus(1, ChronoUnit.DAYS);

        Map<String, String> teamNames = new LinkedHashMap<>();
        for (Workspace workspace : teams) {
            teamNames.put(workspace.getId(), workspace.getName());
        }

        List<Map<String, Object>> teamRows = new ArrayList<>();
        for (Workspace workspace : teams) {
            List<User> members = allUsers.stream()
                    .filter(user -> workspace.getId().equals(user.getWorkspaceId()))
                    .sorted(Comparator.comparing(User::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                    .toList();
            List<Lead> teamLeads = allLeads.stream().filter(l -> workspace.getId().equals(l.getWorkspaceId())).toList();
            List<Contact> teamContacts = allContacts.stream().filter(c -> workspace.getId().equals(c.getWorkspaceId())).toList();
            List<FollowUp> teamTasks = allTasks.stream().filter(t -> workspace.getId().equals(t.getWorkspaceId())).toList();
            List<Note> teamNotes = allNotes.stream().filter(n -> workspace.getId().equals(n.getWorkspaceId())).toList();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", workspace.getId());
            row.put("name", workspace.getName());
            row.put("inviteCode", workspace.getInviteCode());
            row.put("createdAt", workspace.getCreatedAt());
            row.put("memberCount", members.size());
            row.put("leadCount", teamLeads.size());
            row.put("contactCount", teamContacts.size());
            row.put("followUpCount", teamTasks.size());
            row.put("noteCount", teamNotes.size());
            row.put("pipelineValue", teamLeads.stream().mapToLong(Lead::getValue).sum());
            row.put("members", members.stream().map(user -> person(user, teamNames, allLeads, allContacts, allTasks, allNotes)).toList());
            row.put("leads", teamLeads.stream().sorted(Comparator.comparingLong(Lead::getValue).reversed()).map(this::leadRow).toList());
            row.put("contacts", teamContacts.stream().map(this::contactRow).toList());
            row.put("followUps", teamTasks.stream().map(this::taskRow).toList());
            row.put("notes", teamNotes.stream().map(this::noteRow).toList());
            teamRows.add(row);
        }
        teamRows.sort(Comparator.comparing(row -> String.valueOf(row.get("name")), String.CASE_INSENSITIVE_ORDER));

        List<Map<String, Object>> people = allUsers.stream()
                .sorted(Comparator.comparing(User::getLastLoginAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(user -> person(user, teamNames, allLeads, allContacts, allTasks, allNotes))
                .toList();

        List<Map<String, Object>> sessions = logins.findTop80ByOrderByCreatedAtDesc().stream().map(this::session).toList();
        long signedInToday = allUsers.stream()
                .filter(user -> user.getLastLoginAt() != null && user.getLastLoginAt().isAfter(dayAgo))
                .count();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("teamCount", teams.size());
        body.put("userCount", allUsers.size());
        body.put("leadCount", allLeads.size());
        body.put("pipelineValue", allLeads.stream().mapToLong(Lead::getValue).sum());
        body.put("signedInToday", signedInToday);
        body.put("sessionCount", sessions.size());
        body.put("teams", teamRows);
        body.put("people", people);
        body.put("sessions", sessions);
        return body;
    }

    private Map<String, Object> person(User user, Map<String, String> teamNames, List<Lead> allLeads,
                                       List<Contact> allContacts, List<FollowUp> allTasks, List<Note> allNotes) {
        List<Lead> ownedLeads = allLeads.stream().filter(l -> user.getId().equals(l.getOwnerId())).toList();
        String workspaceId = user.getWorkspaceId();
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", user.getId());
        row.put("name", user.getName());
        row.put("email", user.getEmail());
        row.put("role", Catalog.normalizeRole(user.getRole()));
        row.put("title", user.getTitle() == null ? "" : user.getTitle());
        row.put("team", workspaceId == null ? "Unassigned" : teamNames.getOrDefault(workspaceId, "Unassigned"));
        row.put("lastLoginAt", user.getLastLoginAt());
        row.put("loginCount", user.getLoginCount());
        row.put("createdAt", user.getCreatedAt());
        row.put("platformAdmin", user.isPlatformAdmin());
        row.put("leadCount", ownedLeads.size());
        row.put("pipelineValue", ownedLeads.stream().mapToLong(Lead::getValue).sum());
        row.put("contactCount", allContacts.stream().filter(c -> user.getId().equals(c.getOwnerId())).count());
        row.put("followUpCount", allTasks.stream().filter(t -> user.getId().equals(t.getOwnerId()) || user.getId().equals(t.getAssigneeId())).count());
        row.put("noteCount", allNotes.stream().filter(n -> user.getId().equals(n.getOwnerId())).count());
        row.put("leads", ownedLeads.stream().map(this::leadRow).toList());
        return row;
    }

    private Map<String, Object> leadRow(Lead lead) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", lead.getId());
        row.put("name", lead.getName());
        row.put("company", lead.getCompany() == null ? "" : lead.getCompany());
        row.put("email", lead.getEmail() == null ? "" : lead.getEmail());
        row.put("stage", lead.getStage());
        row.put("value", lead.getValue());
        row.put("ownerName", lead.getOwnerName() == null ? "" : lead.getOwnerName());
        row.put("updatedAt", lead.getUpdatedAt());
        return row;
    }

    private Map<String, Object> contactRow(Contact contact) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", contact.getId());
        row.put("name", contact.getName());
        row.put("company", contact.getCompany() == null ? "" : contact.getCompany());
        row.put("email", contact.getEmail() == null ? "" : contact.getEmail());
        row.put("phone", contact.getPhone() == null ? "" : contact.getPhone());
        return row;
    }

    private Map<String, Object> noteRow(Note note) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", note.getId());
        row.put("authorName", note.getAuthorName() == null ? "" : note.getAuthorName());
        row.put("body", note.getBody() == null ? "" : note.getBody());
        row.put("linkedName", note.getLinkedName() == null ? "" : note.getLinkedName());
        row.put("createdAt", note.getCreatedAt());
        return row;
    }

    private Map<String, Object> taskRow(FollowUp task) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", task.getId());
        row.put("title", task.getTitle());
        row.put("status", task.getStatus());
        row.put("dueDate", task.getDueDate());
        row.put("assigneeName", task.getAssigneeName() == null ? "" : task.getAssigneeName());
        row.put("leadName", task.getLeadName() == null ? "" : task.getLeadName());
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
