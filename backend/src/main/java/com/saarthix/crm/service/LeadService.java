package com.saarthix.crm.service;

import com.saarthix.crm.domain.Catalog;
import com.saarthix.crm.domain.DuplicateLeadException;
import com.saarthix.crm.domain.LeadScore;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.model.User;
import com.saarthix.crm.repo.LeadRepository;
import com.saarthix.crm.repo.NoteRepository;
import com.saarthix.crm.repo.UserRepository;
import com.saarthix.crm.security.Scope;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class LeadService {
    private final LeadRepository leads;
    private final NoteRepository notes;
    private final UserRepository users;
    private final ActivityService activities;
    private final NotificationService notifications;
    private final CsvImporter importer;
    private final Scope scope;

    public LeadService(LeadRepository leads, NoteRepository notes, UserRepository users,
                       ActivityService activities, NotificationService notifications,
                       CsvImporter importer, Scope scope) {
        this.leads = leads;
        this.notes = notes;
        this.users = users;
        this.activities = activities;
        this.notifications = notifications;
        this.importer = importer;
        this.scope = scope;
    }

    public Map<String, Object> list(String q, String stage, String priority, String source, String owner, String sort) {
        List<Lead> all = workspaceLeads();
        all.forEach(this::decorate);
        String query = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        List<Lead> filtered = all.stream()
                .filter(lead -> query.isEmpty()
                        || contains(lead.getName(), query)
                        || contains(lead.getCompany(), query)
                        || contains(lead.getEmail(), query)
                        || contains(lead.getOwnerName(), query))
                .filter(lead -> blank(stage) || stage.equalsIgnoreCase(lead.getStage()))
                .filter(lead -> blank(priority) || "All priority".equalsIgnoreCase(priority) || priority.equalsIgnoreCase(lead.getPriority()))
                .filter(lead -> blank(source) || "All sources".equalsIgnoreCase(source) || source.equalsIgnoreCase(lead.getSource()))
                .filter(lead -> blank(owner) || "All owners".equalsIgnoreCase(owner) || owner.equals(lead.getOwnerId()))
                .sorted(sorter(sort))
                .toList();
        return Map.of("summary", summary(all), "leads", filtered);
    }

    public Lead get(String id) {
        Lead lead = owned(id);
        decorate(lead);
        return lead;
    }

    public Map<String, Object> detail(String id) {
        Lead lead = get(id);
        return Map.of("lead", lead, "activity", activities.forLead(lead.getId()));
    }

    public Lead create(LeadRequest request, boolean force) {
        if (!force) {
            List<Lead> matches = duplicates(request.email(), request.company(), request.name(), null);
            if (!matches.isEmpty()) throw new DuplicateLeadException(matches);
        }
        Lead lead = new Lead();
        lead.setWorkspaceId(scope.workspaceId());
        lead.setCreatedAt(Instant.now());
        apply(lead, request, true);
        leads.save(lead);
        decorate(lead);
        User me = scope.user();
        activities.log(lead, me, "created", "Lead added", lead.getName() + " joined the pipeline.");
        notifications.push(lead.getOwnerId(), lead.getWorkspaceId(), "lead",
                "Lead added", lead.getName() + " is now in the pipeline.", "/leads?lead=" + lead.getId());
        return lead;
    }

    public Lead update(String id, LeadRequest request, boolean force) {
        Lead lead = owned(id);
        if (!force) {
            List<Lead> matches = duplicates(request.email(), request.company(), request.name(), lead.getId());
            if (!matches.isEmpty()) throw new DuplicateLeadException(matches);
        }
        String previousName = lead.getName();
        String previousStage = lead.getStage();
        String previousOwner = lead.getOwnerId();
        apply(lead, request, false);
        leads.save(lead);
        if (!previousName.equals(lead.getName())) {
            notes.findByWorkspaceIdAndLinkedId(scope.workspaceId(), lead.getId()).forEach(note -> {
                note.setLinkedName(lead.getName());
                notes.save(note);
            });
        }
        User me = scope.user();
        if (previousStage != null && !previousStage.equals(lead.getStage())) {
            activities.log(lead, me, "stage", "Moved to " + lead.getStage(),
                    closeDetail(previousStage, lead));
        }
        if (previousOwner != null && !previousOwner.equals(lead.getOwnerId())) {
            activities.log(lead, me, "owner", "Owner changed",
                    (blank(previousOwner) ? "Unassigned" : ownerName(previousOwner)) + " → " + lead.getOwnerName());
            if (lead.getOwnerId() != null && !lead.getOwnerId().equals(me.getId())) {
                notifications.push(lead.getOwnerId(), lead.getWorkspaceId(), "owner",
                        "Lead assigned to you", lead.getName() + " is now yours.", "/leads?lead=" + lead.getId());
            }
        }
        decorate(lead);
        return lead;
    }

    public Lead move(String id, StageRequest request) {
        Catalog.require(request.stage(), Catalog.STAGES, "Stage");
        Lead lead = owned(id);
        String previous = lead.getStage();
        applyClose(lead, request.stage(), request.closeReason(), request.closeNote());
        lead.setStage(request.stage());
        lead.setUpdatedAt(Instant.now());
        leads.save(lead);
        activities.log(lead, scope.user(), "stage", "Moved to " + lead.getStage(), closeDetail(previous, lead));
        decorate(lead);
        return lead;
    }

    public void delete(String id) {
        Lead lead = owned(id);
        activities.deleteForLead(lead.getId());
        leads.delete(lead);
    }

    public Map<String, Object> bulkDelete(IdsRequest request) {
        int removed = 0;
        if (request.ids() != null) {
            for (String id : request.ids()) {
                leads.findById(id).filter(lead -> scope.sameWorkspace(lead.getWorkspaceId())).ifPresent(lead -> {
                    activities.deleteForLead(lead.getId());
                    leads.delete(lead);
                });
                removed++;
            }
        }
        return Map.of("removed", removed);
    }

    public Map<String, Object> importCsv(ImportRequest request) {
        CsvImporter.Result parsed = importer.parse(request.csv() == null ? "" : request.csv());
        User owner = resolveOwner(request.ownerId());
        boolean skip = request.skipDuplicates() == null || request.skipDuplicates();
        int created = 0;
        int skipped = 0;
        List<String> problems = new ArrayList<>(parsed.problems());
        for (CsvImporter.Row row : parsed.rows()) {
            List<Lead> matches = duplicates(row.email(), row.company(), row.name(), null);
            if (!matches.isEmpty() && skip) {
                skipped++;
                problems.add("Row " + row.line() + ": skipped " + row.name() + " — already in the workspace");
                continue;
            }
            Lead lead = new Lead();
            lead.setWorkspaceId(scope.workspaceId());
            lead.setCreatedAt(Instant.now());
            lead.setUpdatedAt(Instant.now());
            lead.setOwnerId(owner.getId());
            lead.setOwnerName(owner.getName());
            lead.setName(row.name());
            lead.setCompany(row.company());
            lead.setEmail(row.email());
            lead.setPhone(row.phone());
            lead.setValue(row.value());
            lead.setStage(row.stage());
            lead.setPriority(row.priority());
            lead.setSource(row.source());
            lead.setNotes(row.notes());
            applyClose(lead, row.stage(), defaultReason(row.stage()), "");
            leads.save(lead);
            activities.log(lead, scope.user(), "created", "Imported lead", row.name() + " came from a spreadsheet.");
            created++;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("created", created);
        body.put("skipped", skipped);
        body.put("problems", problems);
        return body;
    }

    public List<Lead> workspaceLeads() {
        List<Lead> all = leads.findByWorkspaceId(scope.workspaceId());
        all.forEach(this::decorate);
        return all;
    }

    private void apply(Lead lead, LeadRequest request, boolean creating) {
        Catalog.require(request.stage(), Catalog.STAGES, "Stage");
        Catalog.require(request.priority(), Catalog.PRIORITIES, "Priority");
        Catalog.require(request.source(), Catalog.SOURCES, "Source");
        if (request.value() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Deal value cannot be negative");
        }
        User owner = resolveOwner(request.ownerId());
        lead.setOwnerId(owner.getId());
        lead.setOwnerName(owner.getName());
        lead.setName(request.name().trim());
        lead.setCompany(request.company() == null ? "" : request.company().trim());
        lead.setEmail(request.email() == null ? "" : request.email().trim());
        lead.setPhone(request.phone() == null ? "" : request.phone().trim());
        lead.setValue(request.value());
        applyClose(lead, request.stage(), request.closeReason(), request.closeNote());
        lead.setStage(request.stage());
        lead.setPriority(request.priority());
        lead.setSource(request.source());
        lead.setNotes(request.notes() == null ? "" : request.notes().trim());
        lead.setUpdatedAt(Instant.now());
        if (creating && lead.getWorkspaceId() == null) {
            lead.setWorkspaceId(scope.workspaceId());
        }
    }

    private void applyClose(Lead lead, String stage, String reason, String note) {
        boolean closing = !Catalog.isOpen(stage);
        if (closing) {
            List<String> allowed = "Won".equals(stage) ? Catalog.WON_REASONS : Catalog.LOST_REASONS;
            if (reason == null || reason.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Pick a " + stage.toLowerCase(Locale.ROOT) + " reason so the team can see why the number moved");
            }
            Catalog.require(reason, allowed, stage + " reason");
            lead.setCloseReason(reason);
            lead.setCloseNote(note == null ? "" : note.trim());
            if (lead.getClosedAt() == null || !stage.equals(lead.getStage())) {
                lead.setClosedAt(Instant.now());
            }
        } else {
            lead.setCloseReason("");
            lead.setCloseNote("");
            lead.setClosedAt(null);
        }
    }

    private List<Lead> duplicates(String email, String company, String name, String excludeId) {
        String mail = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        String firm = company == null ? "" : company.trim().toLowerCase(Locale.ROOT);
        String person = name == null ? "" : name.trim().toLowerCase(Locale.ROOT);
        return leads.findByWorkspaceId(scope.workspaceId()).stream()
                .filter(lead -> excludeId == null || !excludeId.equals(lead.getId()))
                .filter(lead -> {
                    boolean sameEmail = !mail.isBlank() && mail.equalsIgnoreCase(nullToEmpty(lead.getEmail()));
                    boolean sameAccount = !firm.isBlank() && !person.isBlank()
                            && firm.equals(nullToEmpty(lead.getCompany()).toLowerCase(Locale.ROOT))
                            && person.equals(nullToEmpty(lead.getName()).toLowerCase(Locale.ROOT));
                    return sameEmail || sameAccount;
                })
                .toList();
    }

    private Lead owned(String id) {
        return leads.findById(id)
                .filter(lead -> scope.sameWorkspace(lead.getWorkspaceId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lead not found"));
    }

    private User resolveOwner(String ownerId) {
        if (ownerId == null || ownerId.isBlank()) {
            return scope.user();
        }
        return users.findById(ownerId)
                .filter(user -> scope.workspaceId().equals(user.getWorkspaceId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "That teammate is not in this workspace"));
    }

    private String ownerName(String ownerId) {
        return users.findById(ownerId).map(User::getName).orElse("Unassigned");
    }

    private void decorate(Lead lead) {
        lead.setScore(LeadScore.of(lead));
        lead.setWeight(Catalog.weight(lead.getStage()));
        lead.setWeightedValue(Catalog.weighted(lead.getValue(), lead.getStage()));
        if (lead.getOwnerName() == null || lead.getOwnerName().isBlank()) {
            lead.setOwnerName(ownerName(lead.getOwnerId()));
        }
    }

    private Map<String, Object> summary(List<Lead> all) {
        long totalValue = all.stream().mapToLong(Lead::getValue).sum();
        long open = all.stream().filter(l -> Catalog.isOpen(l.getStage())).mapToLong(Lead::getValue).sum();
        long won = all.stream().filter(l -> "Won".equals(l.getStage())).mapToLong(Lead::getValue).sum();
        long forecast = all.stream().mapToLong(l -> Catalog.weighted(l.getValue(), l.getStage())).sum();
        long count = all.size();
        Map<String, Long> stages = new HashMap<>();
        for (String stage : Catalog.STAGES) {
            stages.put(stage, all.stream().filter(l -> stage.equals(l.getStage())).count());
        }
        Map<String, Long> wonReasons = new LinkedHashMap<>();
        Map<String, Long> lostReasons = new LinkedHashMap<>();
        Catalog.WON_REASONS.forEach(reason -> wonReasons.put(reason,
                all.stream().filter(l -> "Won".equals(l.getStage()) && reason.equals(l.getCloseReason())).count()));
        Catalog.LOST_REASONS.forEach(reason -> lostReasons.put(reason,
                all.stream().filter(l -> "Lost".equals(l.getStage()) && reason.equals(l.getCloseReason())).count()));
        return Map.of(
                "total", count,
                "totalValue", totalValue,
                "openPipeline", open,
                "wonValue", won,
                "forecast", forecast,
                "avgDeal", count == 0 ? 0 : Math.round((double) totalValue / count),
                "stages", stages,
                "wonReasons", wonReasons,
                "lostReasons", lostReasons);
    }

    private String closeDetail(String previous, Lead lead) {
        StringBuilder text = new StringBuilder(previous == null ? "Created" : previous).append(" → ").append(lead.getStage());
        if (lead.getCloseReason() != null && !lead.getCloseReason().isBlank()) {
            text.append(" · ").append(lead.getCloseReason());
        }
        if (lead.getCloseNote() != null && !lead.getCloseNote().isBlank()) {
            text.append(" — ").append(lead.getCloseNote());
        }
        return text.toString();
    }

    private String defaultReason(String stage) {
        return "Won".equals(stage) ? "Other" : "Lost".equals(stage) ? "Other" : "";
    }

    private Comparator<Lead> sorter(String sort) {
        Comparator<Lead> byUpdated = Comparator.comparing(Lead::getUpdatedAt, Comparator.nullsLast(Comparator.naturalOrder()));
        return switch (sort == null ? "" : sort) {
            case "value_asc" -> Comparator.comparingLong(Lead::getValue);
            case "value_desc" -> Comparator.comparingLong(Lead::getValue).reversed();
            case "updated_asc" -> byUpdated;
            default -> byUpdated.reversed();
        };
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }

    private boolean blank(String value) {
        return value == null || value.isBlank() || "All".equalsIgnoreCase(value);
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    public record LeadRequest(
            @NotBlank(message = "Name is required") String name,
            String company,
            String email,
            String phone,
            @NotNull(message = "Deal value is required") Long value,
            @NotBlank String stage,
            @NotBlank String priority,
            @NotBlank String source,
            String notes,
            String ownerId,
            String closeReason,
            String closeNote) {
    }

    public record StageRequest(@NotBlank String stage, String closeReason, String closeNote) {
    }

    public record IdsRequest(List<String> ids) {
    }

    public record ImportRequest(String csv, String ownerId, Boolean skipDuplicates) {
    }
}
