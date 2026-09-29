package com.saarthix.crm.service;

import com.saarthix.crm.domain.Catalog;
import com.saarthix.crm.model.FollowUp;
import com.saarthix.crm.model.MeetingLog;
import com.saarthix.crm.repo.DealRepository;
import com.saarthix.crm.repo.FollowUpRepository;
import com.saarthix.crm.repo.LeadRepository;
import com.saarthix.crm.repo.MeetingLogRepository;
import com.saarthix.crm.security.Scope;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class MeetingLogService {
    private final MeetingLogRepository logs;
    private final FollowUpService followUps;
    private final FollowUpRepository tasks;
    private final LeadRepository leads;
    private final DealRepository deals;
    private final ActivityService activities;
    private final Scope scope;

    public MeetingLogService(MeetingLogRepository logs, FollowUpService followUps, FollowUpRepository tasks,
                             LeadRepository leads, DealRepository deals, ActivityService activities, Scope scope) {
        this.logs = logs;
        this.followUps = followUps;
        this.tasks = tasks;
        this.leads = leads;
        this.deals = deals;
        this.activities = activities;
        this.scope = scope;
    }

    public Optional<MeetingLog> findForEvent(String followUpId) {
        followUps.get(followUpId);
        return logs.findFirstByFollowUpId(followUpId);
    }

    public Map<String, Object> list(String q, String type, String leadId) {
        String query = q == null ? "" : q.trim().toLowerCase(java.util.Locale.ROOT);
        String kind = type == null ? "" : type.trim();
        String lead = leadId == null ? "" : leadId.trim();
        List<MeetingLog> rows = visibleLogs().stream()
                .filter(log -> query.isEmpty()
                        || contains(log.getTitle(), query)
                        || contains(log.getLeadName(), query)
                        || contains(log.getTopicsDiscussed(), query)
                        || contains(log.getDecisions(), query))
                .filter(log -> kind.isEmpty() || kind.equals(log.getType()))
                .filter(log -> lead.isEmpty() || lead.equals(log.getLeadId()))
                .sorted(Comparator.comparing(MeetingLog::getMeetingDate, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(MeetingLog::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        List<Map<String, Object>> unlogged = followUps.visible().stream()
                .filter(task -> Catalog.canLogMeeting(task.getType()))
                .filter(task -> task.getMeetingLogId() == null || task.getMeetingLogId().isBlank())
                .filter(task -> !"Pending Approval".equals(task.getApprovalStatus()))
                .sorted(Comparator.comparing(FollowUp::getDueDate, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::unloggedRow)
                .toList();
        Map<String, Object> summary = new java.util.LinkedHashMap<>();
        summary.put("total", rows.size());
        summary.put("unlogged", unlogged.size());
        summary.put("hot", rows.stream().filter(log -> "Hot".equals(log.getInterestLevel())).count());
        return Map.of("logs", rows, "unlogged", unlogged, "summary", summary);
    }

    public MeetingLog get(String id) {
        return logs.findById(id)
                .filter(this::canSee)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting log not found"));
    }

    private List<MeetingLog> visibleLogs() {
        if (scope.isPlatformAdmin()) return logs.findAll();
        List<MeetingLog> all = logs.findByWorkspaceId(scope.workspaceId());
        if (scope.seesTeamData()) return all;
        String me = scope.id();
        java.util.Set<String> leadIds = leads.findByWorkspaceIdAndOwnerId(scope.workspaceId(), me).stream()
                .map(com.saarthix.crm.model.Lead::getId)
                .collect(java.util.stream.Collectors.toSet());
        return all.stream()
                .filter(log -> me.equals(log.getOwnerId()) || me.equals(log.getCreatedById())
                        || (log.getLeadId() != null && leadIds.contains(log.getLeadId())))
                .toList();
    }

    private boolean canSee(MeetingLog log) {
        if (scope.canSee(log.getWorkspaceId(), log.getOwnerId())) return true;
        return log.getLeadId() != null && !log.getLeadId().isBlank()
                && leads.findById(log.getLeadId())
                .filter(lead -> scope.canSee(lead.getWorkspaceId(), lead.getOwnerId()))
                .isPresent();
    }

    private Map<String, Object> unloggedRow(FollowUp task) {
        Map<String, Object> row = new java.util.LinkedHashMap<>();
        row.put("id", task.getId());
        row.put("type", task.getType());
        row.put("title", task.getTitle());
        row.put("dueDate", task.getDueDate());
        row.put("dueTime", task.getDueTime());
        row.put("leadId", task.getLeadId());
        row.put("leadName", task.getLeadName());
        row.put("assigneeName", task.getAssigneeName());
        row.put("attendees", task.getAttendees());
        row.put("contactPerson", task.getContactPerson());
        return row;
    }

    private static boolean contains(String value, String query) {
        return value != null && value.toLowerCase(java.util.Locale.ROOT).contains(query);
    }

    public MeetingLog save(String followUpId, LogRequest request) {
        FollowUp event = followUps.get(followUpId);
        if (!Catalog.canLogMeeting(event.getType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Meeting logs are for meetings, demos and college visits.");
        }
        Catalog.require(request.interestLevel(), Catalog.INTEREST_LEVELS, "Interest level");
        if (request.nextFollowUpDate() != null && !request.nextFollowUpDate().isBlank()) {
            try {
                LocalDate.parse(request.nextFollowUpDate());
            } catch (Exception ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid next follow-up date");
            }
        }

        MeetingLog log = logs.findFirstByFollowUpId(followUpId).orElseGet(MeetingLog::new);
        boolean created = log.getId() == null;
        if (created) {
            log.setWorkspaceId(scope.workspaceId());
            log.setOwnerId(scope.id());
            log.setFollowUpId(event.getId());
            log.setCreatedAt(Instant.now());
            log.setCreatedById(scope.id());
            log.setCreatedByName(scope.user().getName());
        }
        log.setType(event.getType());
        log.setTitle(event.getTitle());
        log.setLeadId(event.getLeadId());
        log.setLeadName(event.getLeadName());
        log.setDealId(event.getDealId());
        log.setDealName(event.getDealName());
        log.setMeetingDate(event.getDueDate());
        log.setMeetingTime(event.getDueTime());
        log.setAttendees(blank(request.attendees()) ? defaultAttendees(event) : request.attendees().trim());
        log.setTopicsDiscussed(trim(request.topicsDiscussed()));
        log.setRequirements(trim(request.requirements()));
        log.setFeedback(trim(request.feedback()));
        log.setInterestLevel(request.interestLevel());
        log.setDecisions(trim(request.decisions()));
        log.setFollowUpAction(trim(request.followUpAction()));
        log.setNextFollowUpDate(trim(request.nextFollowUpDate()));
        log.setUpdatedAt(Instant.now());
        logs.save(log);

        event.setMeetingLogId(log.getId());
        if (!"Completed".equals(event.getStatus())) event.setStatus("Completed");
        tasks.save(event);
        followUps.syncNextFollowUp(event.getLeadId());

        String summary = summary(log);
        leads.findById(blank(event.getLeadId()) ? "_" : event.getLeadId())
                .filter(lead -> scope.canSee(lead.getWorkspaceId(), lead.getOwnerId()))
                .ifPresent(lead -> activities.log(lead, scope.user(), "meeting",
                        event.getType() + " logged", summary));
        deals.findById(blank(event.getDealId()) ? "_" : event.getDealId())
                .filter(deal -> scope.sameWorkspace(deal.getWorkspaceId()))
                .ifPresent(deal -> activities.logDeal(deal, scope.user(), "meeting",
                        event.getType() + " logged", summary));

        if (created && !blank(log.getNextFollowUpDate()) && !blank(log.getFollowUpAction())) {
            String nextType = Catalog.TASK_TYPES.contains(log.getFollowUpAction()) ? log.getFollowUpAction() : "Follow-up";
            String who = blank(event.getLeadName()) ? (blank(event.getDealName()) ? event.getTitle() : event.getDealName()) : event.getLeadName();
            followUps.create(new FollowUpService.TaskRequest(
                    log.getFollowUpAction() + " · " + who,
                    "From " + event.getType().toLowerCase() + " log: " + (blank(log.getDecisions()) ? log.getTopicsDiscussed() : log.getDecisions()),
                    log.getNextFollowUpDate(),
                    event.getPriority() == null ? "Medium" : event.getPriority(),
                    "Pending",
                    event.getLeadId(),
                    event.getAssigneeId(),
                    event.getAssigneeName(),
                    nextType,
                    null, null,
                    event.getReminder() == null ? "None" : event.getReminder(),
                    event.getDealId(),
                    null, null, null, null, null, null, null));
        }
        return log;
    }

    private static String defaultAttendees(FollowUp event) {
        String names = event.getAssigneeName() == null ? "" : event.getAssigneeName();
        if (event.getAttendees() != null && !event.getAttendees().isBlank()) {
            names = names.isBlank() ? event.getAttendees() : names + ", " + event.getAttendees();
        }
        if (event.getContactPerson() != null && !event.getContactPerson().isBlank()) {
            names = names.isBlank() ? event.getContactPerson() : names + ", " + event.getContactPerson();
        }
        return names;
    }

    private static String summary(MeetingLog log) {
        StringBuilder body = new StringBuilder();
        if (!blank(log.getInterestLevel())) body.append("Interest: ").append(log.getInterestLevel());
        if (!blank(log.getTopicsDiscussed())) {
            if (!body.isEmpty()) body.append(" · ");
            body.append(log.getTopicsDiscussed());
        }
        if (!blank(log.getFollowUpAction())) {
            if (!body.isEmpty()) body.append(" · ");
            body.append("Next: ").append(log.getFollowUpAction());
            if (!blank(log.getNextFollowUpDate())) body.append(" by ").append(log.getNextFollowUpDate());
        }
        return body.toString();
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    public record LogRequest(
            String attendees,
            @NotBlank(message = "Record what was discussed") String topicsDiscussed,
            String requirements,
            String feedback,
            @NotBlank(message = "Choose an interest level") String interestLevel,
            String decisions,
            String followUpAction,
            String nextFollowUpDate) {
    }
}
