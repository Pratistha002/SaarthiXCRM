package com.saarthix.crm.web;

import com.saarthix.crm.model.AppNotification;
import com.saarthix.crm.model.Contact;
import com.saarthix.crm.model.Deal;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.model.Note;
import com.saarthix.crm.repo.ContactRepository;
import com.saarthix.crm.repo.LeadRepository;
import com.saarthix.crm.repo.NoteRepository;
import com.saarthix.crm.repo.NotificationRepository;
import com.saarthix.crm.security.Scope;
import com.saarthix.crm.service.ActivityService;
import com.saarthix.crm.service.DashboardService;
import com.saarthix.crm.service.DealService;
import com.saarthix.crm.service.MailService;
import com.saarthix.crm.service.ReminderService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
public class InsightController {
    private final DashboardService dashboard;
    private final MailService mail;
    private final ActivityService activities;
    private final ReminderService reminders;
    private final NotificationRepository notifications;
    private final LeadRepository leads;
    private final ContactRepository contacts;
    private final NoteRepository notes;
    private final DealService deals;
    private final Scope scope;

    public InsightController(DashboardService dashboard, MailService mail, ActivityService activities,
                             ReminderService reminders, NotificationRepository notifications, LeadRepository leads,
                             ContactRepository contacts, NoteRepository notes, DealService deals, Scope scope) {
        this.deals = deals;
        this.dashboard = dashboard;
        this.mail = mail;
        this.activities = activities;
        this.reminders = reminders;
        this.notifications = notifications;
        this.leads = leads;
        this.contacts = contacts;
        this.notes = notes;
        this.scope = scope;
    }

    @GetMapping("/api/dashboard")
    public Map<String, Object> dashboard() {
        return dashboard.snapshot();
    }

    @GetMapping("/api/mail/status")
    public Map<String, Object> mailStatus() {
        return Map.of("configured", mail.configured(), "inboxUrl", mail.inboxUrl());
    }

    @PostMapping("/api/mail/send")
    public Map<String, Object> send(@Valid @RequestBody SendRequest request) {
        if (request.dealId() != null && !request.dealId().isBlank()) {
            Deal deal = deals.owned(request.dealId());
            Contact contact = deal.getPrimaryContactId() == null ? null : contacts.findById(deal.getPrimaryContactId()).orElse(null);
            if (contact == null || contact.getEmail() == null || contact.getEmail().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The deal's primary contact has no email address");
            }
            mail.send(contact.getEmail(), request.subject(), request.body(), scope.user().getEmail());
            activities.logDeal(deal, scope.user(), "email", "Email sent: " + request.subject(), request.body());
            return Map.of("sent", true, "to", contact.getEmail(), "subject", request.subject());
        }
        if (request.leadId() == null || request.leadId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose who to email");
        }
        Lead lead = leads.findById(request.leadId())
                .filter(item -> scope.canSee(item.getWorkspaceId(), item.getOwnerId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lead not found"));
        mail.send(lead.getEmail(), request.subject(), request.body(), scope.user().getEmail());
        activities.log(lead, scope.user(), "email", "Email sent: " + request.subject(), request.body());
        return Map.of("sent", true, "to", lead.getEmail(), "subject", request.subject());
    }

    @PostMapping("/api/reminders/run")
    public Map<String, Object> reminders() {
        scope.requireAdmin();
        return reminders.run();
    }

    @GetMapping("/api/notifications")
    public List<AppNotification> notifications() {
        return notifications.findTop40ByUserIdOrderByCreatedAtDesc(scope.id());
    }

    @PostMapping("/api/notifications/{id}/read")
    public AppNotification read(@PathVariable String id) {
        AppNotification notification = notifications.findById(id)
                .filter(n -> scope.id().equals(n.getUserId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));
        notification.setRead(true);
        return notifications.save(notification);
    }

    @PostMapping("/api/notifications/read-all")
    public Map<String, Object> readAll() {
        List<AppNotification> rows = notifications.findTop40ByUserIdOrderByCreatedAtDesc(scope.id());
        rows.forEach(n -> n.setRead(true));
        notifications.saveAll(rows);
        return Map.of("updated", rows.size());
    }

    @GetMapping("/api/search")
    public Map<String, Object> search(@RequestParam(defaultValue = "") String q) {
        String query = q.trim().toLowerCase(Locale.ROOT);
        if (query.isBlank()) {
            return Map.of("leads", List.of(), "contacts", List.of(), "notes", List.of());
        }
        List<Lead> leadPool = scope.isPlatformAdmin() ? leads.findAll()
                : scope.seesTeamData() ? leads.findByWorkspaceId(scope.workspaceId())
                : leads.findByWorkspaceIdAndOwnerId(scope.workspaceId(), scope.id());
        List<Contact> contactPool = scope.isPlatformAdmin() ? contacts.findAll()
                : scope.seesTeamData() ? contacts.findByWorkspaceId(scope.workspaceId())
                : contacts.findByWorkspaceIdAndOwnerId(scope.workspaceId(), scope.id());
        List<Note> notePool = scope.isPlatformAdmin() ? notes.findAll() : notes.findByWorkspaceId(scope.workspaceId());
        if (scope.assignedOnly()) {
            java.util.Set<String> leadIds = leadPool.stream().map(Lead::getId).collect(java.util.stream.Collectors.toSet());
            String me = scope.id();
            notePool = notePool.stream()
                    .filter(n -> me.equals(n.getOwnerId())
                            || (n.getLinkedId() != null && leadIds.contains(n.getLinkedId())))
                    .toList();
        }
        List<Lead> leadHits = leadPool.stream()
                .filter(l -> contains(l.getName(), query) || contains(l.getCompany(), query) || contains(l.getEmail(), query))
                .sorted(Comparator.comparing(Lead::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(6)
                .toList();
        List<Contact> contactHits = contactPool.stream()
                .filter(c -> contains(c.getName(), query) || contains(c.getCompany(), query) || contains(c.getEmail(), query))
                .limit(6)
                .toList();
        List<Note> noteHits = notePool.stream()
                .filter(n -> contains(n.getBody(), query) || contains(n.getLinkedName(), query))
                .limit(4)
                .toList();
        return Map.of("leads", leadHits, "contacts", contactHits, "notes", noteHits);
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }

    public record SendRequest(
            String leadId,
            String dealId,
            @NotBlank(message = "Subject is required") String subject,
            @NotBlank(message = "Write the email before sending") String body) {
    }
}
