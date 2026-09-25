package com.saarthix.crm.web;

import com.saarthix.crm.model.AppNotification;
import com.saarthix.crm.model.Contact;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.model.Note;
import com.saarthix.crm.repo.ContactRepository;
import com.saarthix.crm.repo.LeadRepository;
import com.saarthix.crm.repo.NoteRepository;
import com.saarthix.crm.repo.NotificationRepository;
import com.saarthix.crm.security.Scope;
import com.saarthix.crm.service.AiService;
import com.saarthix.crm.service.DashboardService;
import com.saarthix.crm.service.ReminderService;
import jakarta.validation.Valid;
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
    private final AiService ai;
    private final ReminderService reminders;
    private final NotificationRepository notifications;
    private final LeadRepository leads;
    private final ContactRepository contacts;
    private final NoteRepository notes;
    private final Scope scope;

    public InsightController(DashboardService dashboard, AiService ai, ReminderService reminders,
                             NotificationRepository notifications, LeadRepository leads,
                             ContactRepository contacts, NoteRepository notes, Scope scope) {
        this.dashboard = dashboard;
        this.ai = ai;
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

    @PostMapping("/api/ai/email")
    public Map<String, Object> email(@Valid @RequestBody AiService.EmailRequest request) {
        return ai.email(request);
    }

    @PostMapping("/api/ai/email/send")
    public Map<String, Object> send(@Valid @RequestBody AiService.SendRequest request) {
        return ai.send(request);
    }

    @GetMapping("/api/mail/status")
    public Map<String, Object> mailStatus() {
        return ai.mailStatus();
    }

    @PostMapping("/api/ai/summary")
    public Map<String, Object> summary(@Valid @RequestBody AiService.IdRequest request) {
        return ai.summary(request);
    }

    @PostMapping("/api/ai/next-step")
    public Map<String, Object> next(@Valid @RequestBody AiService.IdRequest request) {
        return ai.nextStep(request);
    }

    @PostMapping("/api/ai/pipeline")
    public Map<String, Object> pipeline() {
        return ai.pipeline();
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
        String workspaceId = scope.workspaceId();
        if (query.isBlank()) {
            return Map.of("leads", List.of(), "contacts", List.of(), "notes", List.of());
        }
        List<Lead> leadHits = leads.findByWorkspaceId(workspaceId).stream()
                .filter(l -> contains(l.getName(), query) || contains(l.getCompany(), query) || contains(l.getEmail(), query))
                .sorted(Comparator.comparing(Lead::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(6)
                .toList();
        List<Contact> contactHits = contacts.findByWorkspaceId(workspaceId).stream()
                .filter(c -> contains(c.getName(), query) || contains(c.getCompany(), query) || contains(c.getEmail(), query))
                .limit(6)
                .toList();
        List<Note> noteHits = notes.findByWorkspaceId(workspaceId).stream()
                .filter(n -> contains(n.getBody(), query) || contains(n.getLinkedName(), query))
                .limit(4)
                .toList();
        return Map.of("leads", leadHits, "contacts", contactHits, "notes", noteHits);
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }
}
