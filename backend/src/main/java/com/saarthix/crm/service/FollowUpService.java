package com.saarthix.crm.service;

import com.saarthix.crm.domain.Catalog;
import com.saarthix.crm.model.Deal;
import com.saarthix.crm.model.FollowUp;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.model.User;
import com.saarthix.crm.repo.DealRepository;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class FollowUpService {
    private final FollowUpRepository tasks;
    private final LeadRepository leads;
    private final DealRepository deals;
    private final UserRepository users;
    private final ActivityService activities;
    private final NotificationService notifications;
    private final Scope scope;

    public FollowUpService(FollowUpRepository tasks, LeadRepository leads, DealRepository deals, UserRepository users,
                           ActivityService activities, NotificationService notifications, Scope scope) {
        this.tasks = tasks;
        this.leads = leads;
        this.deals = deals;
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

    public FollowUp get(String id) {
        return owned(id);
    }

    public List<FollowUp> visible() {
        return visibleTasks();
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
        linkedDeal(task.getDealId()).ifPresent(deal ->
                activities.logDeal(deal, scope.user(), "task", "Activity scheduled", task.getTitle() + " due " + dueText(task)));
        return task;
    }

    public FollowUp createForLead(String leadId, TaskRequest request) {
        linkedLead(leadId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lead not found"));
        return create(request.withLead(leadId));
    }

    public FollowUp createForDeal(String dealId, TaskRequest request) {
        linkedDeal(dealId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Deal not found"));
        return create(request.withDeal(dealId));
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
                    "/calendar?event=" + task.getId());
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

    public static Instant dueInstant(FollowUp task) {
        if (task.getDueAt() != null) return task.getDueAt();
        if (task.getDueDate() == null || task.getDueDate().isBlank()) return null;
        try {
            return LocalDate.parse(task.getDueDate()).atStartOfDay(ZoneId.systemDefault()).toInstant();
        } catch (Exception ex) {
            return null;
        }
    }

    public static Instant endInstant(FollowUp task) {
        if (task.getEndAt() != null) return task.getEndAt();
        Instant start = dueInstant(task);
        if (start == null) return null;
        int minutes = task.getDurationMinutes() == null || task.getDurationMinutes() <= 0
                ? (Catalog.isTimedEvent(task.getType()) ? 30 : 0)
                : task.getDurationMinutes();
        return minutes <= 0 ? start : start.plusSeconds(minutes * 60L);
    }

    public static String dueText(FollowUp task) {
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
        if (request.purpose() != null && !request.purpose().isBlank()) {
            Catalog.require(request.purpose(), Catalog.VISIT_PURPOSES, "Visit purpose");
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
        Deal deal = linkedDeal(request.dealId()).orElse(null);
        task.setDealId(deal == null ? null : deal.getId());
        task.setDealName(deal == null ? null : deal.getName());
        task.setAccountId(deal == null ? null : deal.getAccountId());
        task.setContactId(deal == null ? null : deal.getPrimaryContactId());
        task.setAssigneeId(assignee.getId());
        task.setAssigneeName(assignee.getName());
        if (request.location() != null) task.setLocation(trim(request.location()));
        else if (task.getLocation() == null) task.setLocation("");
        if (request.meetingLink() != null) task.setMeetingLink(trim(request.meetingLink()));
        else if (task.getMeetingLink() == null) task.setMeetingLink("");
        if (request.contactPerson() != null) task.setContactPerson(trim(request.contactPerson()));
        else if (task.getContactPerson() == null) task.setContactPerson("");
        if (request.purpose() != null) task.setPurpose(trim(request.purpose()));
        else if (task.getPurpose() == null) task.setPurpose("");
        if (request.attendees() != null) task.setAttendees(trim(request.attendees()));
        else if (task.getAttendees() == null) task.setAttendees("");
        if (request.attendeeIds() != null) {
            task.setAttendeeIds(sanitizeAttendees(request.attendeeIds(), assignee.getId()));
        } else if (task.getAttendeeIds() == null) {
            task.setAttendeeIds(sanitizeAttendees(null, assignee.getId()));
        }
        if (request.durationMinutes() != null) {
            if (request.durationMinutes() < 0 || request.durationMinutes() > 12 * 60) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Duration must be between 0 and 12 hours");
            }
            task.setDurationMinutes(request.durationMinutes());
        } else if (task.getDurationMinutes() == null) {
            task.setDurationMinutes(Catalog.defaultDuration(task.getType()));
        }
        computeEnd(task);
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
            Instant dueAt = parseInstant(request.dueAt());
            if (dueAt == null) {
                dueAt = LocalDate.parse(request.dueDate())
                        .atTime(LocalTime.parse(request.dueTime()))
                        .atZone(ZoneId.systemDefault())
                        .toInstant();
            }
            task.setDueAt(dueAt);
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

    private static void computeEnd(FollowUp task) {
        Instant start = dueInstant(task);
        if (start == null || task.getDueTime() == null || task.getDueTime().isBlank()) {
            task.setEndAt(start);
            return;
        }
        int minutes = task.getDurationMinutes() == null || task.getDurationMinutes() <= 0
                ? Catalog.defaultDuration(task.getType())
                : task.getDurationMinutes();
        if (minutes <= 0) minutes = 30;
        task.setDurationMinutes(minutes);
        task.setEndAt(start.plusSeconds(minutes * 60L));
    }

    private List<String> sanitizeAttendees(List<String> attendeeIds, String assigneeId) {
        List<String> ids = new ArrayList<>();
        if (assigneeId != null && !assigneeId.isBlank()) ids.add(assigneeId);
        if (attendeeIds == null) return ids;
        for (String id : attendeeIds) {
            if (id == null || id.isBlank() || ids.contains(id)) continue;
            users.findById(id)
                    .filter(user -> scope.isPlatformAdmin() || scope.workspaceId().equals(user.getWorkspaceId()))
                    .ifPresent(user -> ids.add(user.getId()));
        }
        return ids;
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
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
                        "/calendar?event=" + task.getId()));
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

    private java.util.Optional<Deal> linkedDeal(String dealId) {
        if (dealId == null || dealId.isBlank()) return java.util.Optional.empty();
        return deals.findById(dealId).filter(deal -> scope.sameWorkspace(deal.getWorkspaceId()));
    }

    private void notifyAssignee(FollowUp task, boolean created) {
        String type = task.getType() == null || task.getType().isBlank() ? "Follow-up" : task.getType();
        String title = created ? type + " added to your calendar" : type + " updated";
        String body = task.getTitle() + " · " + dueText(task);
        String link = "/calendar?event=" + task.getId();
        if (task.getAssigneeId() != null && !task.getAssigneeId().equals(scope.id())) {
            notifications.push(task.getAssigneeId(), task.getWorkspaceId(), "task", title, body, link);
        }
        if (task.getAttendeeIds() == null) return;
        for (String attendeeId : task.getAttendeeIds()) {
            if (attendeeId == null || attendeeId.equals(scope.id()) || attendeeId.equals(task.getAssigneeId())) continue;
            notifications.push(attendeeId, task.getWorkspaceId(), "task",
                    "Added to " + type.toLowerCase(), body, link);
        }
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
                        || (task.getAttendeeIds() != null && task.getAttendeeIds().contains(me))
                        || (task.getLeadId() != null && leadIds.contains(task.getLeadId())))
                .toList();
    }

    private FollowUp owned(String id) {
        return tasks.findById(id)
                .filter(t -> scope.canSeeTask(t.getWorkspaceId(), t.getOwnerId(), t.getAssigneeId())
                        || (t.getAttendeeIds() != null && t.getAttendeeIds().contains(scope.id()))
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
            String reminder,
            String dealId,
            String location,
            String meetingLink,
            String contactPerson,
            String purpose,
            Integer durationMinutes,
            List<String> attendeeIds,
            String attendees) {
        public TaskRequest withLead(String leadId) {
            return new TaskRequest(title(), details(), dueDate(), priority(), status(), leadId, assigneeId(),
                    assigneeName(), type(), dueTime(), dueAt(), reminder(), dealId(), location(), meetingLink(),
                    contactPerson(), purpose(), durationMinutes(), attendeeIds(), attendees());
        }

        public TaskRequest withDeal(String dealId) {
            return new TaskRequest(title(), details(), dueDate(), priority(), status(), leadId(), assigneeId(),
                    assigneeName(), type(), dueTime(), dueAt(), reminder(), dealId, location(), meetingLink(),
                    contactPerson(), purpose(), durationMinutes(), attendeeIds(), attendees());
        }
    }

    public record StatusRequest(@NotBlank String status) {
    }
}
