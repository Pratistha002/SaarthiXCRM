package com.saarthix.crm.service;

import com.saarthix.crm.domain.Catalog;
import com.saarthix.crm.model.Activity;
import com.saarthix.crm.model.CallLog;
import com.saarthix.crm.model.FollowUp;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.repo.LeadRepository;
import com.saarthix.crm.security.Scope;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Logs a call made from the lead page. No telephony provider is involved: the CRM only records what the
 * salesperson reports, so duration stays empty and startedAt is only the moment they tapped "Start Call".
 */
@Service
public class CallService {
    private static final Pattern PHONE = Pattern.compile("\\+?\\d{7,15}");
    private static final Map<String, String> TASK_TITLES = Map.of(
            "Call", "Call back",
            "Follow-up", "Follow up",
            "Meeting", "Meeting",
            "Demo", "Product demo",
            "Send Proposal", "Send proposal",
            "Email", "Send email",
            "WhatsApp", "WhatsApp message");

    private final LeadRepository leads;
    private final LeadService leadService;
    private final FollowUpService followUps;
    private final ActivityService activities;
    private final Scope scope;

    public CallService(LeadRepository leads, LeadService leadService, FollowUpService followUps,
                       ActivityService activities, Scope scope) {
        this.leads = leads;
        this.leadService = leadService;
        this.followUps = followUps;
        this.activities = activities;
        this.scope = scope;
    }

    public Map<String, Object> log(String leadId, CallRequest request) {
        Lead lead = owned(leadId);

        Activity existing = activities.findCall(lead.getId(), request.requestId()).orElse(null);
        if (existing != null) return result(existing, lead.getId(), true);

        String phone = dialablePhone(lead, request.phone());
        String outcome = request.outcome();
        if (blank(outcome)) throw bad("Please select a call outcome.");
        Catalog.require(outcome, Catalog.CALL_OUTCOMES, "Call outcome");

        boolean connected = Catalog.CONNECTED.equals(outcome);
        String response = connected ? request.customerResponse() : "";
        String responseOther = "";
        if (connected) {
            if (blank(response)) throw bad("Please select the customer's response.");
            Catalog.require(response, Catalog.CALL_RESPONSES, "Customer response");
            if ("Other".equals(response)) {
                if (blank(request.customerResponseOther())) throw bad("Describe the customer's response.");
                responseOther = request.customerResponseOther().trim();
            }
        }

        String nextAction = request.nextAction();
        if (blank(nextAction)) throw bad("Please choose what should happen next.");
        boolean schedule = !Catalog.NO_FURTHER_ACTION.equals(nextAction);
        if (schedule) Catalog.require(nextAction, Catalog.TASK_TYPES, "Next action");
        Instant dueAt = schedule ? validateSchedule(request) : null;
        String reminder = blank(request.reminder()) ? "None" : request.reminder();
        if (schedule && !Catalog.REMINDER_MINUTES.containsKey(reminder)) throw bad("Pick a valid reminder.");

        String stageBefore = lead.getStage();
        String stageAfter = blank(request.stage()) ? stageBefore : request.stage();
        boolean stageChanged = !stageAfter.equals(stageBefore);
        if (stageChanged) {
            Catalog.require(stageAfter, Catalog.STAGES, "Lead status");
            if (Catalog.isWon(stageAfter)) throw bad("Use the Convert button to convert this lead.");
            if (Catalog.isExit(stageAfter)) {
                if (blank(request.closeReason())) throw bad("Pick a reason for marking this lead " + stageAfter + ".");
                Catalog.require(request.closeReason(), Catalog.reasonsFor(stageAfter), stageAfter + " reason");
            }
        }

        Instant now = Instant.now();
        CallLog call = new CallLog();
        call.setRequestId(blank(request.requestId()) ? null : request.requestId());
        call.setPhone(phone);
        call.setOutcome(outcome);
        call.setCustomerResponse(response);
        call.setCustomerResponseOther(responseOther);
        call.setNotes(request.notes() == null ? "" : request.notes().trim());
        call.setStartedAt(plausibleStart(request.startedAt(), now));
        call.setCompletedAt(now);
        call.setDurationSeconds(null);
        call.setNextAction(nextAction);
        if (schedule) {
            call.setNextActionDate(request.dueDate());
            call.setNextActionTime(request.dueTime());
            call.setNextActionAt(dueAt);
        }
        call.setStageBefore(stageBefore);
        call.setStageAfter(stageAfter);

        Activity activity = activities.logCall(lead, scope.user(),
                connected ? "Call completed" : "Call attempted · " + outcome, summary(call), call);

        if (schedule) {
            FollowUp task = followUps.createForLead(lead.getId(), new FollowUpService.TaskRequest(
                    TASK_TITLES.get(nextAction) + " · " + lead.getName(),
                    call.getNotes().isBlank() ? "From call: " + outcomeText(call) : call.getNotes(),
                    request.dueDate(),
                    Catalog.PRIORITIES.contains(lead.getPriority()) ? lead.getPriority() : "Medium",
                    "Pending", lead.getId(), scope.id(), null,
                    nextAction, request.dueTime(), dueAt.toString(), reminder));
            call.setFollowUpId(task.getId());
            activity = activities.save(activity);
        }

        if (stageChanged) {
            leadService.move(lead.getId(), new LeadService.StageRequest(stageAfter,
                    Catalog.isExit(stageAfter) ? request.closeReason() : null,
                    Catalog.isExit(stageAfter) ? request.closeNote() : null));
        }

        Lead fresh = owned(lead.getId());
        fresh.setLastContactedAt(now);
        fresh.setUpdatedAt(now);
        leads.save(fresh);

        return result(activity, lead.getId(), false);
    }

    private Instant validateSchedule(CallRequest request) {
        String message = "Please select a date and time for the next action.";
        if (blank(request.dueDate()) || blank(request.dueTime()) || blank(request.dueAt())) throw bad(message);
        Instant dueAt;
        try {
            LocalDate.parse(request.dueDate());
            LocalTime.parse(request.dueTime());
            dueAt = Instant.parse(request.dueAt());
        } catch (Exception ex) {
            throw bad(message);
        }
        if (dueAt.isBefore(Instant.now().minus(Duration.ofMinutes(5)))) {
            throw bad("The next action is in the past. Pick a future date and time.");
        }
        return dueAt;
    }

    /** Uses the number the salesperson picked only if it belongs to this lead; otherwise phone, then mobile. */
    private String dialablePhone(Lead lead, String chosen) {
        String raw = !blank(lead.getPhone()) ? lead.getPhone() : lead.getMobile();
        if (!blank(chosen) && (digits(chosen).equals(digits(lead.getPhone())) || digits(chosen).equals(digits(lead.getMobile())))) {
            raw = chosen;
        }
        if (blank(raw)) throw bad("No phone number is available for this lead.");
        if (!PHONE.matcher(digits(raw)).matches()) {
            throw bad("The phone number on this lead doesn't look valid. Edit the lead to fix it.");
        }
        return raw.trim();
    }

    private Instant plausibleStart(String startedAt, Instant now) {
        if (blank(startedAt)) return null;
        try {
            Instant start = Instant.parse(startedAt);
            boolean sane = !start.isAfter(now) && start.isAfter(now.minus(Duration.ofHours(12)));
            return sane ? start : null;
        } catch (Exception ex) {
            return null;
        }
    }

    private String outcomeText(CallLog call) {
        if (!Catalog.CONNECTED.equals(call.getOutcome())) return call.getOutcome();
        String response = "Other".equals(call.getCustomerResponse()) ? call.getCustomerResponseOther() : call.getCustomerResponse();
        return call.getOutcome() + " · " + response;
    }

    private String summary(CallLog call) {
        StringBuilder text = new StringBuilder("Outcome: ").append(outcomeText(call));
        if (!call.getNotes().isBlank()) text.append("\nNotes: ").append(call.getNotes());
        text.append("\nNext action: ").append(call.getNextAction());
        if (call.getNextActionDate() != null) {
            text.append(" on ").append(call.getNextActionDate()).append(' ').append(call.getNextActionTime());
        }
        return text.toString();
    }

    private Map<String, Object> result(Activity activity, String leadId, boolean duplicate) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("activity", activity);
        body.put("lead", leadService.get(leadId));
        body.put("duplicate", duplicate);
        return body;
    }

    private Lead owned(String id) {
        return leads.findById(id)
                .filter(lead -> scope.canSee(lead.getWorkspaceId(), lead.getOwnerId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lead not found"));
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static String digits(String value) {
        return value == null ? "" : value.replaceAll("[\\s().-]", "");
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    public record CallRequest(
            String requestId,
            String phone,
            String outcome,
            String customerResponse,
            String customerResponseOther,
            String notes,
            String startedAt,
            String nextAction,
            String dueDate,
            String dueTime,
            String dueAt,
            String reminder,
            String stage,
            String closeReason,
            String closeNote) {
    }
}
