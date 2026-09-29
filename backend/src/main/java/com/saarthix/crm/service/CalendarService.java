package com.saarthix.crm.service;

import com.saarthix.crm.domain.Catalog;
import com.saarthix.crm.model.FollowUp;
import com.saarthix.crm.model.MeetingLog;
import com.saarthix.crm.model.User;
import com.saarthix.crm.repo.UserRepository;
import com.saarthix.crm.security.Scope;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class CalendarService {
    private final FollowUpService followUps;
    private final MeetingLogService logs;
    private final UserRepository users;
    private final Scope scope;

    public CalendarService(FollowUpService followUps, MeetingLogService logs, UserRepository users, Scope scope) {
        this.followUps = followUps;
        this.logs = logs;
        this.users = users;
        this.scope = scope;
    }

    public Map<String, Object> range(String from, String to, String assigneeId, String type) {
        LocalDate start = parseDay(from, "from");
        LocalDate end = parseDay(to, "to");
        if (end.isBefore(start)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "End date must be on or after the start date");
        }
        String mine = scope.id();
        boolean team = scope.seesTeamData();
        String assignee = team ? blankToNull(assigneeId) : mine;
        String kind = blankToNull(type);
        if (kind != null) Catalog.require(kind, Catalog.TASK_TYPES, "Event type");

        List<FollowUp> events = followUps.visible().stream()
                .filter(task -> inRange(task, start, end))
                .filter(task -> assignee == null || assignee.equals(task.getAssigneeId())
                        || (task.getAttendeeIds() != null && task.getAttendeeIds().contains(assignee)))
                .filter(task -> kind == null || kind.equals(task.getType()))
                .sorted(Comparator
                        .comparing(FollowUp::getDueDate, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(task -> task.getDueTime() == null ? "" : task.getDueTime()))
                .toList();

        List<Map<String, Object>> rows = events.stream().map(task -> eventRow(task, events)).toList();
        Map<String, Long> byType = events.stream()
                .collect(Collectors.groupingBy(task -> task.getType() == null || task.getType().isBlank() ? "Follow-up" : task.getType(), Collectors.counting()));
        Map<String, Long> byPerson = team ? events.stream()
                .filter(task -> task.getAssigneeId() != null)
                .collect(Collectors.groupingBy(task -> task.getAssigneeName() == null ? "Unassigned" : task.getAssigneeName(), Collectors.counting()))
                : Map.of();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("from", start.toString());
        summary.put("to", end.toString());
        summary.put("count", events.size());
        summary.put("open", events.stream().filter(task -> !"Completed".equals(task.getStatus())).count());
        summary.put("conflicts", rows.stream().filter(row -> Boolean.TRUE.equals(row.get("conflict"))).count());
        summary.put("logged", events.stream().filter(task -> task.getMeetingLogId() != null && !task.getMeetingLogId().isBlank()).count());
        summary.put("byType", byType);
        summary.put("byPerson", byPerson);
        summary.put("teamView", team);
        return Map.of("events", rows, "summary", summary);
    }

    public Map<String, Object> one(String id) {
        FollowUp task = followUps.get(id);
        List<FollowUp> nearby = followUps.visible();
        Map<String, Object> row = eventRow(task, nearby);
        row.put("log", logs.findForEvent(id).orElse(null));
        row.put("conflicts", overlaps(task, nearby).stream().map(this::brief).toList());
        return row;
    }

    public Map<String, Object> create(FollowUpService.TaskRequest request) {
        validateEvent(request);
        FollowUp task = followUps.create(request);
        return saved(task);
    }

    public Map<String, Object> update(String id, FollowUpService.TaskRequest request) {
        validateEvent(request);
        FollowUp task = followUps.update(id, request);
        return saved(task);
    }

    public MeetingLog getLog(String id) {
        return logs.findForEvent(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "No meeting log yet"));
    }

    public MeetingLog log(String id, MeetingLogService.LogRequest request) {
        return logs.save(id, request);
    }

    private Map<String, Object> saved(FollowUp task) {
        List<FollowUp> nearby = followUps.visible();
        Map<String, Object> row = eventRow(task, nearby);
        row.put("conflicts", overlaps(task, nearby).stream().map(this::brief).toList());
        return row;
    }

    private void validateEvent(FollowUpService.TaskRequest request) {
        String type = request.type();
        if (type == null || type.isBlank()) return;
        Catalog.require(type, Catalog.TASK_TYPES, "Event type");
        if (Catalog.isTimedEvent(type) && (request.dueTime() == null || request.dueTime().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, type + " needs a time so it shows on the schedule.");
        }
        if ("Visit".equals(type) && (request.location() == null || request.location().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add the college location for this visit.");
        }
        if (("Meeting".equals(type) || "Demo".equals(type))
                && (request.meetingLink() == null || request.meetingLink().isBlank())
                && (request.location() == null || request.location().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add a meeting link or a location.");
        }
    }

    private Map<String, Object> eventRow(FollowUp task, List<FollowUp> nearby) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", task.getId());
        row.put("type", task.getType() == null || task.getType().isBlank() ? "Follow-up" : task.getType());
        row.put("title", task.getTitle());
        row.put("details", task.getDetails());
        row.put("dueDate", task.getDueDate());
        row.put("dueTime", task.getDueTime());
        row.put("dueAt", task.getDueAt());
        row.put("endAt", FollowUpService.endInstant(task));
        row.put("durationMinutes", task.getDurationMinutes());
        row.put("reminder", task.getReminder());
        row.put("priority", task.getPriority());
        row.put("status", task.getStatus());
        row.put("approvalStatus", task.getApprovalStatus());
        row.put("leadId", task.getLeadId());
        row.put("leadName", task.getLeadName());
        row.put("dealId", task.getDealId());
        row.put("dealName", task.getDealName());
        row.put("assigneeId", task.getAssigneeId());
        row.put("assigneeName", task.getAssigneeName());
        row.put("ownerId", task.getOwnerId());
        row.put("location", task.getLocation());
        row.put("meetingLink", task.getMeetingLink());
        row.put("contactPerson", task.getContactPerson());
        row.put("purpose", task.getPurpose());
        row.put("attendeeIds", task.getAttendeeIds() == null ? List.of() : task.getAttendeeIds());
        row.put("attendeeNames", attendeeNames(task));
        row.put("attendees", task.getAttendees());
        row.put("meetingLogId", task.getMeetingLogId());
        row.put("logged", task.getMeetingLogId() != null && !task.getMeetingLogId().isBlank());
        row.put("canLog", Catalog.canLogMeeting(task.getType()));
        row.put("allDay", task.getDueTime() == null || task.getDueTime().isBlank());
        row.put("conflict", !overlaps(task, nearby).isEmpty());
        return row;
    }

    private Map<String, Object> brief(FollowUp task) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", task.getId());
        row.put("title", task.getTitle());
        row.put("type", task.getType());
        row.put("dueDate", task.getDueDate());
        row.put("dueTime", task.getDueTime());
        row.put("assigneeName", task.getAssigneeName());
        return row;
    }

    private List<String> attendeeNames(FollowUp task) {
        List<String> names = new ArrayList<>();
        if (task.getAttendeeIds() != null) {
            for (String id : task.getAttendeeIds()) {
                users.findById(id).map(User::getName).ifPresent(names::add);
            }
        }
        if (task.getAttendees() != null && !task.getAttendees().isBlank()) {
            for (String extra : task.getAttendees().split(",")) {
                String name = extra.trim();
                if (!name.isBlank() && names.stream().noneMatch(existing -> existing.equalsIgnoreCase(name))) {
                    names.add(name);
                }
            }
        }
        return names;
    }

    private List<FollowUp> overlaps(FollowUp task, List<FollowUp> nearby) {
        Instant start = FollowUpService.dueInstant(task);
        Instant end = FollowUpService.endInstant(task);
        if (start == null || end == null || task.getDueTime() == null || task.getDueTime().isBlank()) return List.of();
        if ("Completed".equals(task.getStatus()) || Catalog.isPendingApproval(task.getApprovalStatus())) return List.of();
        return nearby.stream()
                .filter(other -> !Objects.equals(other.getId(), task.getId()))
                .filter(other -> !"Completed".equals(other.getStatus()) && !Catalog.isPendingApproval(other.getApprovalStatus()))
                .filter(other -> samePeople(task, other))
                .filter(other -> other.getDueTime() != null && !other.getDueTime().isBlank())
                .filter(other -> overlaps(start, end, FollowUpService.dueInstant(other), FollowUpService.endInstant(other)))
                .toList();
    }

    private static boolean samePeople(FollowUp a, FollowUp b) {
        if (a.getAssigneeId() != null && a.getAssigneeId().equals(b.getAssigneeId())) return true;
        if (a.getAttendeeIds() == null || b.getAttendeeIds() == null) return false;
        return a.getAttendeeIds().stream().anyMatch(id -> b.getAttendeeIds().contains(id));
    }

    private static boolean overlaps(Instant start, Instant end, Instant otherStart, Instant otherEnd) {
        if (start == null || end == null || otherStart == null || otherEnd == null) return false;
        return start.isBefore(otherEnd) && otherStart.isBefore(end);
    }

    private static boolean inRange(FollowUp task, LocalDate start, LocalDate end) {
        if (task.getDueDate() == null || task.getDueDate().isBlank()) return false;
        try {
            LocalDate day = LocalDate.parse(task.getDueDate());
            return !day.isBefore(start) && !day.isAfter(end);
        } catch (Exception ex) {
            return false;
        }
    }

    private static LocalDate parseDay(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a " + label + " date");
        }
        try {
            return LocalDate.parse(value);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid " + label + " date");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() || "all".equalsIgnoreCase(value) ? null : value;
    }
}
