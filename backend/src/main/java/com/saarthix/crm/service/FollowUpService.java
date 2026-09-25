package com.saarthix.crm.service;

import com.saarthix.crm.domain.Catalog;
import com.saarthix.crm.model.FollowUp;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.model.User;
import com.saarthix.crm.repo.FollowUpRepository;
import com.saarthix.crm.repo.LeadRepository;
import com.saarthix.crm.repo.UserRepository;
import com.saarthix.crm.security.Scope;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class FollowUpService {
    private final FollowUpRepository tasks;
    private final LeadRepository leads;
    private final UserRepository users;
    private final ActivityService activities;
    private final NotificationService notifications;
    private final Scope scope;

    public FollowUpService(FollowUpRepository tasks, LeadRepository leads, UserRepository users,
                           ActivityService activities, NotificationService notifications, Scope scope) {
        this.tasks = tasks;
        this.leads = leads;
        this.users = users;
        this.activities = activities;
        this.notifications = notifications;
        this.scope = scope;
    }

    public Map<String, Object> list(String filter) {
        List<FollowUp> all = tasks.findByWorkspaceId(scope.workspaceId());
        LocalDate today = LocalDate.now();
        String mode = filter == null ? "All" : filter;
        List<FollowUp> filtered = all.stream()
                .filter(task -> switch (mode) {
                    case "Pending" -> "Pending".equals(task.getStatus());
                    case "In Progress" -> "In Progress".equals(task.getStatus());
                    case "Completed" -> "Completed".equals(task.getStatus());
                    case "Overdue" -> overdue(task, today);
                    default -> true;
                })
                .sorted(Comparator
                        .comparing((FollowUp t) -> !overdue(t, today))
                        .thenComparing(t -> "Completed".equals(t.getStatus()))
                        .thenComparing(FollowUp::getDueDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        long completed = all.stream().filter(t -> "Completed".equals(t.getStatus())).count();
        long overdue = all.stream().filter(t -> overdue(t, today)).count();
        long pending = all.stream().filter(t -> "Pending".equals(t.getStatus()) && !overdue(t, today)).count();
        long total = all.size();
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total", total);
        summary.put("pending", pending);
        summary.put("overdue", overdue);
        summary.put("completed", completed);
        summary.put("donePct", total == 0 ? 0 : Math.round(completed * 100.0 / total));
        summary.put("today", today.toString());
        return Map.of("tasks", filtered, "summary", summary);
    }

    public FollowUp create(TaskRequest request) {
        FollowUp task = new FollowUp();
        task.setWorkspaceId(scope.workspaceId());
        task.setOwnerId(scope.id());
        task.setCreatedAt(Instant.now());
        apply(task, request);
        tasks.save(task);
        notifyAssignee(task, true);
        linkedLead(task.getLeadId()).ifPresent(lead ->
                activities.log(lead, scope.user(), "task", "Follow-up added", task.getTitle() + " due " + task.getDueDate()));
        return task;
    }

    public FollowUp update(String id, TaskRequest request) {
        FollowUp task = owned(id);
        apply(task, request);
        tasks.save(task);
        notifyAssignee(task, false);
        return task;
    }

    public FollowUp status(String id, StatusRequest request) {
        Catalog.require(request.status(), Catalog.TASK_STATUSES, "Status");
        FollowUp task = owned(id);
        task.setStatus(request.status());
        return tasks.save(task);
    }

    public void delete(String id) {
        tasks.delete(owned(id));
    }

    public static boolean overdue(FollowUp task, LocalDate today) {
        if ("Completed".equals(task.getStatus()) || task.getDueDate() == null || task.getDueDate().isBlank()) {
            return false;
        }
        return LocalDate.parse(task.getDueDate()).isBefore(today);
    }

    private void apply(FollowUp task, TaskRequest request) {
        Catalog.require(request.priority(), Catalog.PRIORITIES, "Priority");
        Catalog.require(request.status(), Catalog.TASK_STATUSES, "Status");
        try {
            LocalDate.parse(request.dueDate());
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid due date");
        }
        User assignee = resolveAssignee(request.assigneeId());
        Lead lead = linkedLead(request.leadId()).orElse(null);
        task.setTitle(request.title().trim());
        task.setDetails(request.details() == null ? "" : request.details().trim());
        task.setDueDate(request.dueDate());
        task.setPriority(request.priority());
        task.setStatus(request.status());
        task.setLeadId(lead == null ? "" : lead.getId());
        task.setLeadName(lead == null ? "" : lead.getName());
        task.setAssigneeId(assignee.getId());
        task.setAssigneeName(assignee.getName());
        task.setRemindedOn(null);
    }

    private User resolveAssignee(String assigneeId) {
        if (assigneeId == null || assigneeId.isBlank()) {
            return scope.user();
        }
        return users.findById(assigneeId)
                .filter(user -> scope.workspaceId().equals(user.getWorkspaceId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "That teammate is not in this workspace"));
    }

    private java.util.Optional<Lead> linkedLead(String leadId) {
        if (leadId == null || leadId.isBlank()) return java.util.Optional.empty();
        return leads.findById(leadId).filter(lead -> scope.sameWorkspace(lead.getWorkspaceId()));
    }

    private void notifyAssignee(FollowUp task, boolean created) {
        if (task.getAssigneeId() == null || task.getAssigneeId().equals(scope.id())) return;
        notifications.push(task.getAssigneeId(), task.getWorkspaceId(), "task",
                created ? "Follow-up assigned to you" : "Follow-up updated",
                task.getTitle() + " is due " + task.getDueDate(), "/follow-ups");
    }

    private FollowUp owned(String id) {
        return tasks.findById(id)
                .filter(t -> scope.sameWorkspace(t.getWorkspaceId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Follow-up not found"));
    }

    public record TaskRequest(
            @NotBlank(message = "Title is required") String title,
            String details,
            @NotBlank(message = "Due date is required") String dueDate,
            @NotBlank String priority,
            @NotBlank String status,
            String leadId,
            String assigneeId,
            String assigneeName) {
    }

    public record StatusRequest(@NotBlank String status) {
    }
}
