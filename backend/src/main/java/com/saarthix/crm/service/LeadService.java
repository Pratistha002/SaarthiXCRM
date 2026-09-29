package com.saarthix.crm.service;

import com.saarthix.crm.domain.Catalog;
import com.saarthix.crm.domain.DuplicateLeadException;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.model.User;
import com.saarthix.crm.repo.AttachmentRepository;
import com.saarthix.crm.repo.LeadRepository;
import com.saarthix.crm.repo.NoteRepository;
import com.saarthix.crm.repo.UserRepository;
import com.saarthix.crm.security.Scope;
import jakarta.validation.constraints.NotBlank;
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
    private final AttachmentRepository attachments;
    private final Scope scope;

    public LeadService(LeadRepository leads, NoteRepository notes, UserRepository users,
                       ActivityService activities, NotificationService notifications,
                       CsvImporter importer, AttachmentRepository attachments, Scope scope) {
        this.attachments = attachments;
        this.leads = leads;
        this.notes = notes;
        this.users = users;
        this.activities = activities;
        this.notifications = notifications;
        this.importer = importer;
        this.scope = scope;
    }

    public Map<String, Object> list(String q, String stage, String priority, String source, String owner, String type, String sort) {
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
                .filter(lead -> blank(type) || type.equalsIgnoreCase(lead.getLeadType()))
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
            List<Lead> matches = duplicates(request.email(), request.company(), fullName(request), null);
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
            List<Lead> matches = duplicates(request.email(), request.company(), fullName(request), lead.getId());
            if (!matches.isEmpty()) throw new DuplicateLeadException(matches);
        }
        String previousName = lead.getName();
        String previousStage = lead.getStage();
        String previousOwner = lead.getOwnerId();
        Map<String, String> before = snapshot(lead);
        apply(lead, request, false);
        leads.save(lead);
        Map<String, String> after = snapshot(lead);
        before.forEach((label, old) -> {
            String next = after.get(label);
            if (!old.equals(next)) {
                activities.log(lead, scope.user(), "field", label + " was updated",
                        (old.isEmpty() ? "—" : old) + " → " + (next.isEmpty() ? "—" : next));
            }
        });
        if (!previousName.equals(lead.getName())) {
            notes.findByWorkspaceIdAndLinkedId(lead.getWorkspaceId(), lead.getId()).forEach(note -> {
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
        attachments.deleteByLeadId(lead.getId());
        leads.delete(lead);
    }

    public Map<String, Object> bulkDelete(IdsRequest request) {
        int removed = 0;
        if (request.ids() != null) {
            for (String id : request.ids()) {
                leads.findById(id).filter(lead -> scope.canSee(lead.getWorkspaceId(), lead.getOwnerId())).ifPresent(lead -> {
                    activities.deleteForLead(lead.getId());
                    attachments.deleteByLeadId(lead.getId());
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
        List<Lead> all;
        if (scope.isPlatformAdmin()) {
            all = leads.findAll();
        } else if (scope.seesTeamData()) {
            all = leads.findByWorkspaceId(scope.workspaceId());
        } else {
            all = leads.findByWorkspaceIdAndOwnerId(scope.workspaceId(), scope.id());
        }
        all.forEach(this::decorate);
        return all;
    }

    private void apply(Lead lead, LeadRequest request, boolean creating) {
        String stage = blank(request.stage()) ? "New" : request.stage();
        String priority = blank(request.priority()) ? "Medium" : request.priority();
        String source = nullToEmpty(request.source());
        Catalog.require(stage, Catalog.STAGES, "Lead status");
        Catalog.require(priority, Catalog.PRIORITIES, "Priority");
        if (!source.isEmpty()) Catalog.require(source, Catalog.SOURCES, "Lead source");
        long value = request.value() == null ? 0 : request.value();
        if (value < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Deal value cannot be negative");
        }
        if (request.annualRevenue() != null && request.annualRevenue() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Annual revenue cannot be negative");
        }
        if (request.employees() != null && request.employees() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No. of employees cannot be negative");
        }
        String type = nullToEmpty(request.leadType());
        Catalog.require(type, Catalog.LEAD_TYPES, "Lead type");
        boolean student = "Student".equals(type);
        String fullName = fullName(request);
        if (fullName.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, student ? "Last name is required"
                    : ("Institute".equals(type) ? "Institute name" : "Company name") + " is required");
        }
        String college = student ? nullToEmpty(request.collegeName()) : "";
        User owner = resolveOwner(request.ownerId());
        lead.setOwnerId(owner.getId());
        lead.setOwnerName(owner.getName());
        if (scope.isPlatformAdmin() && owner.getWorkspaceId() != null && !owner.getWorkspaceId().isBlank()) {
            lead.setWorkspaceId(owner.getWorkspaceId());
        }
        lead.setName(fullName);
        lead.setLeadType(type);
        lead.setContactPerson(student ? "" : nullToEmpty(request.contactPerson()));
        lead.setSalutation("");
        lead.setFirstName(student ? nullToEmpty(request.firstName()) : "");
        lead.setLastName(student ? nullToEmpty(request.lastName()) : "");
        lead.setTitle("");
        lead.setCollegeName(college);
        lead.setCourse(student ? nullToEmpty(request.course()) : "");
        lead.setBranch(student ? nullToEmpty(request.branch()) : "");
        lead.setCompany(student ? college : fullName);
        lead.setEmail(nullToEmpty(request.email()));
        lead.setPhone(student ? "" : nullToEmpty(request.phone()));
        lead.setMobile(nullToEmpty(request.mobile()));
        boolean industry = "Industry".equals(type);
        lead.setFax(industry ? nullToEmpty(request.fax()) : "");
        lead.setWebsite(student ? "" : nullToEmpty(request.website()));
        lead.setIndustry("");
        lead.setEmployees(industry ? request.employees() : null);
        lead.setAnnualRevenue(industry ? request.annualRevenue() : null);
        lead.setRating(student ? "" : nullToEmpty(request.rating()));
        lead.setCountry(nullToEmpty(request.country()));
        lead.setBuilding(nullToEmpty(request.building()));
        lead.setStreet(nullToEmpty(request.street()));
        lead.setCity(nullToEmpty(request.city()));
        lead.setState(nullToEmpty(request.state()));
        lead.setZip(nullToEmpty(request.zip()));
        lead.setLatitude(nullToEmpty(request.latitude()));
        lead.setLongitude(nullToEmpty(request.longitude()));
        lead.setValue(value);
        applyClose(lead, stage, request.closeReason(), request.closeNote());
        lead.setStage(stage);
        lead.setPriority(priority);
        lead.setSource(source);
        lead.setNotes(nullToEmpty(request.notes()));
        lead.setUpdatedAt(Instant.now());
        if (creating && lead.getWorkspaceId() == null) {
            lead.setWorkspaceId(scope.workspaceId());
        }
    }

    private void applyClose(Lead lead, String stage, String reason, String note) {
        boolean closing = !Catalog.isOpen(stage);
        if (closing) {
            boolean blankReason = reason == null || reason.isBlank();
            if (blankReason && Catalog.isExit(stage)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Pick a reason for marking this lead " + stage.toLowerCase(Locale.ROOT));
            }
            if (!blankReason) Catalog.require(reason, Catalog.reasonsFor(stage), stage + " reason");
            lead.setCloseReason(blankReason ? "" : reason);
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
        return workspaceLeads().stream()
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
                .filter(lead -> scope.canSee(lead.getWorkspaceId(), lead.getOwnerId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lead not found"));
    }

    private User resolveOwner(String ownerId) {
        if (scope.assignedOnly() || ownerId == null || ownerId.isBlank()) {
            return scope.user();
        }
        return users.findById(ownerId)
                .filter(user -> scope.isPlatformAdmin() || scope.workspaceId().equals(user.getWorkspaceId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "That teammate is not in this workspace"));
    }

    private String ownerName(String ownerId) {
        return users.findById(ownerId).map(User::getName).orElse("Unassigned");
    }

    private void decorate(Lead lead) {
        lead.setWeight(Catalog.weight(lead.getStage()));
        lead.setWeightedValue(Catalog.weighted(lead.getValue(), lead.getStage()));
        if (lead.getOwnerName() == null || lead.getOwnerName().isBlank()) {
            lead.setOwnerName(ownerName(lead.getOwnerId()));
        }
    }

    private Map<String, Object> summary(List<Lead> all) {
        long totalValue = all.stream().mapToLong(Lead::getValue).sum();
        long open = all.stream().filter(l -> Catalog.isOpen(l.getStage())).mapToLong(Lead::getValue).sum();
        long won = all.stream().filter(l -> Catalog.isWon(l.getStage())).mapToLong(Lead::getValue).sum();
        long forecast = all.stream().mapToLong(l -> Catalog.weighted(l.getValue(), l.getStage())).sum();
        long count = all.size();
        Map<String, Long> stages = new HashMap<>();
        for (String stage : Catalog.STAGES) {
            stages.put(stage, all.stream().filter(l -> stage.equals(l.getStage())).count());
        }
        Map<String, Long> wonReasons = new LinkedHashMap<>();
        Map<String, Long> lostReasons = new LinkedHashMap<>();
        Catalog.WON_REASONS.forEach(reason -> wonReasons.put(reason,
                all.stream().filter(l -> Catalog.isWon(l.getStage()) && reason.equals(l.getCloseReason())).count()));
        Catalog.EXIT_REASONS.forEach(reason -> lostReasons.put(reason,
                all.stream().filter(l -> Catalog.isExit(l.getStage()) && reason.equals(l.getCloseReason())).count()));
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
        return Catalog.isExit(stage) ? "Other" : "";
    }

    private Comparator<Lead> sorter(String sort) {
        Comparator<Lead> byUpdated = Comparator.comparing(Lead::getUpdatedAt, Comparator.nullsLast(Comparator.naturalOrder()));
        Comparator<Lead> byCreated = Comparator.comparing(Lead::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()));
        Comparator<Lead> byName = Comparator.comparing(lead -> nullToEmpty(lead.getName()).toLowerCase(Locale.ROOT));
        return switch (sort == null ? "" : sort) {
            case "value_asc" -> Comparator.comparingLong(Lead::getValue);
            case "value_desc" -> Comparator.comparingLong(Lead::getValue).reversed();
            case "updated_asc" -> byUpdated;
            case "name_asc" -> byName;
            case "name_desc" -> byName.reversed();
            case "created_desc" -> byCreated.reversed();
            case "created_asc" -> byCreated;
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

    private Map<String, String> snapshot(Lead lead) {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("Lead Type", nullToEmpty(lead.getLeadType()));
        values.put("Name", nullToEmpty(lead.getName()));
        values.put("Contact Person", nullToEmpty(lead.getContactPerson()));
        values.put("College Name", nullToEmpty(lead.getCollegeName()));
        values.put("Course", nullToEmpty(lead.getCourse()));
        values.put("Branch", nullToEmpty(lead.getBranch()));
        values.put("Email", nullToEmpty(lead.getEmail()));
        values.put("Phone", nullToEmpty(lead.getPhone()));
        values.put("Mobile", nullToEmpty(lead.getMobile()));
        values.put("Fax", nullToEmpty(lead.getFax()));
        values.put("Website", nullToEmpty(lead.getWebsite()));
        values.put("No. of Employees", lead.getEmployees() == null ? "" : String.valueOf(lead.getEmployees()));
        values.put("Annual Revenue", lead.getAnnualRevenue() == null ? "" : "Rs. " + lead.getAnnualRevenue());
        values.put("Rating", nullToEmpty(lead.getRating()));
        values.put("Lead Source", nullToEmpty(lead.getSource()));
        values.put("Deal Value", "Rs. " + lead.getValue());
        values.put("Priority", nullToEmpty(lead.getPriority()));
        values.put("Address", String.join(", ", java.util.stream.Stream.of(lead.getBuilding(), lead.getStreet(),
                lead.getCity(), lead.getState(), lead.getZip(), lead.getCountry())
                .map(this::nullToEmpty).filter(s -> !s.isEmpty()).toList()));
        values.put("Description", nullToEmpty(lead.getNotes()));
        return values;
    }

    private String fullName(LeadRequest request) {
        if (!"Student".equals(request.leadType())) return nullToEmpty(request.company());
        String last = nullToEmpty(request.lastName());
        if (last.isEmpty()) return "";
        return (nullToEmpty(request.firstName()) + " " + last).trim();
    }

    public record LeadRequest(
            String name,
            String leadType,
            String contactPerson,
            String collegeName,
            String course,
            String branch,
            String salutation,
            String firstName,
            String lastName,
            String title,
            String company,
            String email,
            String phone,
            String mobile,
            String fax,
            String website,
            String industry,
            Integer employees,
            Long annualRevenue,
            String rating,
            String country,
            String building,
            String street,
            String city,
            String state,
            String zip,
            String latitude,
            String longitude,
            Long value,
            String stage,
            String priority,
            String source,
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
