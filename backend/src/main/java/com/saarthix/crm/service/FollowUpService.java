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
import java.time.LocalTime;
import java.time.ZoneId;
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
        List<FollowUp> all = visibleTasks();
        LocalDate today = LocalDate.now();
        String mode = filter == null ? "All" : filter;
        List<FollowUp> filtered = all.stream()
                .filter(task -> switch (mode) {
                    case "Pending" -> "Pending".equals(task.getStatus()) && Catalog.isApproved(task.getApprovalStatus());
                    case "In Progress" -> "In Progress".equals(task.getStatus());
                    case "Approved" -> Catalog.APPROVED.equals(task.getStatus()) && Catalog.isApproved(task.getApprovalStatus());
                    case "Awaiting Approval" -> Catalog.isPendingApproval(task.getApprovalStatus());
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
        long pending = all.stream().filter(t -> "Pending".equals(t.getStatus()) && Catalog.isApproved(t.getApprovalStatus()) && !overdue(t, today)).count();
        long awaiting = all.stream().filter(t -> Catalog.isPendingApproval(t.getApprovalStatus())).count();
        long total = all.size();
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total", total);
        summary.put("pending", pending);
        summary.put("awaiting", awaiting);
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
        if (scope.assignedOnly()) {
            task.setApprovalStatus(Catalog.PENDING_APPROVAL);
            task.setStatus("Pending");
            task.setApprovedById(null);
            task.setApprovedByName(null);
            task.setApprovedAt(null);
        } else {
            markApproved(task);
        }
        tasks.save(task);
        if (Catalog.isPendingApproval(task.getApprovalStatus())) {
            notifyHeads(task);
        } else {
            notifyAssignee(task, true);
        }
        linkedLead(task.getLeadId()).ifPresent(lead -> {
            activities.log(lead, scope.user(), "task",
                    Catalog.isPendingApproval(task.getApprovalStatus()) ? "Follow-up submitted for approval" : "Follow-up added",
                    task.getTitle() + " due " + dueText(task));
            syncNextFollowUp(lead.getId());
        });
        return task;
    }

    public FollowUp createForLead(String leadId, TaskRequest request) {
        linkedLead(leadId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lead not found"));
        return create(new TaskRequest(request.title(), request.details(), request.dueDate(), request.priority(),
                request.status(), leadId, request.assigneeId(), request.assigneeName(),
                request.type(), request.dueTime(), request.dueAt(), request.reminder()));
    }

    public FollowUp update(String id, TaskRequest request) {
        FollowUp task = owned(id);
        requireEditable(task);
        String previousLead = task.getLeadId();
        apply(task, request);
        tasks.save(task);
        notifyAssignee(task, false);
        syncNextFollowUp(previousLead);
        if (!java.util.Objects.equals(previousLead, task.getLeadId())) syncNextFollowUp(task.getLeadId());
        return task;
    }

    public FollowUp status(String id, StatusRequest request) {
        Catalog.require(request.status(), Catalog.TASK_STATUSES, "Status");
        FollowUp task = owned(id);
        requireEditable(task);
        task.setStatus(request.status());
        tasks.save(task);
        syncNextFollowUp(task.getLeadId());
        return task;
    }

    public FollowUp approve(String id) {
        scope.requireAdmin();
        FollowUp task = owned(id);
        if (!Catalog.isPendingApproval(task.getApprovalStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This follow-up is already approved");
        }
        markApproved(task);
        task.setStatus(Catalog.APPROVED);
        tasks.save(task);
        if (task.getOwnerId() != null && !task.getOwnerId().equals(scope.id())) {
            notifications.push(task.getOwnerId(), task.getWorkspaceId(), "approval",
                    "Follow-up approved",
                    "“" + task.getTitle() + "” was approved. You can edit it now.",
                    "/follow-ups");
        }
        linkedLead(task.getLeadId()).ifPresent(lead ->
                activities.log(lead, scope.user(), "task", "Follow-up approved", task.getTitle()));
        syncNextFollowUp(task.getLeadId());
        return task;
    }

    public void delete(String id) {
        FollowUp task = owned(id);
        tasks.delete(task);
        syncNextFollowUp(task.getLeadId());
    }

    /** Keeps Lead.nextFollowUpAt equal to the earliest open follow-up on that lead. */
    public void syncNextFollowUp(String leadId) {
        linkedLead(leadId).ifPresent(lead -> {
            Instant next = tasks.findByWorkspaceIdAndLeadId(lead.getWorkspaceId(), lead.getId()).stream()
                    .filter(task -> !"Completed".equals(task.getStatus()) && Catalog.isApproved(task.getApprovalStatus()))
                    .map(FollowUpService::dueInstant)
                    .filter(java.util.Objects::nonNull)
                    .min(Comparator.naturalOrder())
                    .orElse(null);
            if (!java.util.Objects.equals(next, lead.getNextFollowUpAt())) {
                lead.setNextFollowUpAt(next);
                leads.save(lead);
            }
        });
    }

    private static Instant dueInstant(FollowUp task) {
        if (task.getDueAt() != null) return task.getDueAt();
        if (task.getDueDate() == null || task.getDueDate().isBlank()) return null;
        try {
            return LocalDate.parse(task.getDueDate()).atStartOfDay(ZoneId.systemDefault()).toInstant();
        } catch (Exception ex) {
            return null;
        }
    }

    private static String dueText(FollowUp task) {
        return task.getDueTime() == null || task.getDueTime().isBlank()
                ? task.getDueDate() : task.getDueDate() + " " + task.getDueTime();
    }

    public static boolean overdue(FollowUp task, LocalDate today) {
        if ("Completed".equals(task.getStatus()) || Catalog.isPendingApproval(task.getApprovalStatus())
                || task.getDueDate() == null || task.getDueDate().isBlank()) {
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
        if (request.type() != null && !request.type().isBlank()) {
            Catalog.require(request.type(), Catalog.TASK_TYPES, "Follow-up type");
        }
        if (request.reminder() != null && !request.reminder().isBlank()
                && !Catalog.REMINDER_MINUTES.containsKey(request.reminder())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Reminder must be one of: " + String.join(", ", Catalog.REMINDER_MINUTES.keySet()));
        }
        User assignee = resolveAssignee(request.assigneeId());
        Lead lead = linkedLead(request.leadId()).orElse(null);
        applySchedule(task, request);
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

    /**
     * Time, type and reminder are optional so the plain Follow-ups form keeps working. When that form moves
     * the date without sending a time, the old time no longer applies and is cleared.
     */
    private void applySchedule(FollowUp task, TaskRequest request) {
        boolean dateChanged = task.getDueDate() != null && !task.getDueDate().equals(request.dueDate());
        if (request.type() != null) task.setType(request.type().isBlank() ? null : request.type());
        if (request.dueTime() != null && !request.dueTime().isBlank()) {
            try {
                LocalTime.parse(request.dueTime());
            } catch (Exception ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid time");
            }
            task.setDueTime(request.dueTime());
            task.setDueAt(parseInstant(request.dueAt()));
        } else if (dateChanged || request.dueTime() != null) {
            task.setDueTime(null);
            task.setDueAt(null);
        }
        if (request.reminder() != null) task.setReminder(request.reminder().isBlank() ? "None" : request.reminder());
        int minutes = Catalog.REMINDER_MINUTES.getOrDefault(task.getReminder() == null ? "None" : task.getReminder(), 0);
        Instant remindAt = minutes > 0 && task.getDueAt() != null ? task.getDueAt().minusSeconds(minutes * 60L) : null;
        if (!java.util.Objects.equals(remindAt, task.getRemindAt())) {
            task.setRemindAt(remindAt);
            task.setReminderSentAt(null);
        }
    }

    private static Instant parseInstant(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Instant.parse(value);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid date and time");
        }
    }

    private User resolveAssignee(String assigneeId) {
        if (scope.assignedOnly() || assigneeId == null || assigneeId.isBlank()) {
            return scope.user();
        }
        return users.findById(assigneeId)
                .filter(user -> scope.isPlatformAdmin() || scope.workspaceId().equals(user.getWorkspaceId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "That teammate is not in this workspace"));
    }

    private java.util.Optional<Lead> linkedLead(String leadId) {
        if (leadId == null || leadId.isBlank()) return java.util.Optional.empty();
        return leads.findById(leadId).filter(lead -> scope.canSee(lead.getWorkspaceId(), lead.getOwnerId()));
    }

    private void notifyHeads(FollowUp task) {
        User me = scope.user();
        users.findByWorkspaceId(task.getWorkspaceId()).stream()
                .filter(user -> Catalog.isHeadOfSales(user.getRole()) && !user.getId().equals(me.getId()))
                .forEach(head -> notifications.push(head.getId(), task.getWorkspaceId(), "approval",
                        "Follow-up needs approval",
                        me.getName() + " submitted “" + task.getTitle() + "”.",
                        "/follow-ups?filter=Awaiting+Approval"));
    }

    private void markApproved(FollowUp task) {
        task.setApprovalStatus(Catalog.APPROVED);
        task.setApprovedAt(Instant.now());
        task.setApprovedById(scope.id());
        task.setApprovedByName(scope.user().getName());
    }

    private void requireEditable(FollowUp task) {
        if (scope.assignedOnly() && Catalog.isPendingApproval(task.getApprovalStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "This follow-up is waiting for Head of Sales approval");
        }
    }

    private void notifyAssignee(FollowUp task, boolean created) {
        if (task.getAssigneeId() == null || task.getAssigneeId().equals(scope.id())) return;
        notifications.push(task.getAssigneeId(), task.getWorkspaceId(), "task",
                created ? "Follow-up assigned to you" : "Follow-up updated",
                task.getTitle() + " is due " + task.getDueDate(), "/follow-ups");
    }

    private List<FollowUp> visibleTasks() {
        if (scope.isPlatformAdmin()) return tasks.findAll();
        List<FollowUp> all = tasks.findByWorkspaceId(scope.workspaceId());
        if (scope.seesTeamData()) return all;
        String me = scope.id();
        java.util.Set<String> leadIds = leads.findByWorkspaceIdAndOwnerId(scope.workspaceId(), me).stream()
                .map(Lead::getId).collect(java.util.stream.Collectors.toSet());
        return all.stream()
                .filter(task -> me.equals(task.getOwnerId()) || me.equals(task.getAssigneeId())
                        || (task.getLeadId() != null && leadIds.contains(task.getLeadId())))
                .toList();
    }

    private FollowUp owned(String id) {
        return tasks.findById(id)
                .filter(t -> scope.canSeeTask(t.getWorkspaceId(), t.getOwnerId(), t.getAssigneeId())
                        || linkedLead(t.getLeadId()).isPresent())
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
            String assigneeName,
            String type,
            String dueTime,
            String dueAt,
            String reminder) {
    }

    public record StatusRequest(@NotBlank String status) {
    }
}
