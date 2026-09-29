package com.saarthix.crm.service;

import com.saarthix.crm.domain.Catalog;
import com.saarthix.crm.model.Activity;
import com.saarthix.crm.model.Attachment;
import com.saarthix.crm.model.Contact;
import com.saarthix.crm.model.FollowUp;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.model.Note;
import com.saarthix.crm.repo.AttachmentRepository;
import com.saarthix.crm.repo.ContactRepository;
import com.saarthix.crm.repo.FollowUpRepository;
import com.saarthix.crm.repo.LeadRepository;
import com.saarthix.crm.repo.NoteRepository;
import com.saarthix.crm.security.Scope;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class LeadDetailService {
    private static final long MAX_ATTACHMENT_BYTES = 5L * 1024 * 1024;

    private final LeadRepository leads;
    private final NoteRepository notes;
    private final FollowUpRepository tasks;
    private final ContactRepository contacts;
    private final AttachmentRepository attachments;
    private final ActivityService activities;
    private final LeadService leadService;
    private final Scope scope;

    public LeadDetailService(LeadRepository leads, NoteRepository notes, FollowUpRepository tasks,
                             ContactRepository contacts, AttachmentRepository attachments,
                             ActivityService activities, LeadService leadService, Scope scope) {
        this.leads = leads;
        this.notes = notes;
        this.tasks = tasks;
        this.contacts = contacts;
        this.attachments = attachments;
        this.activities = activities;
        this.leadService = leadService;
        this.scope = scope;
    }

    public Map<String, Object> related(String id) {
        Lead lead = leadService.get(id);
        String workspace = lead.getWorkspaceId();
        List<Note> leadNotes = notes.findByWorkspaceIdAndLinkedId(workspace, id).stream()
                .sorted(Comparator.comparing(Note::isPinned).reversed()
                        .thenComparing(Note::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        List<FollowUp> leadTasks = tasks.findByWorkspaceIdAndLeadId(workspace, id).stream()
                .sorted(Comparator.comparing(FollowUp::getDueDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        List<Activity> timeline = activities.forLead(id);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("lead", lead);
        body.put("notes", leadNotes);
        body.put("openActivities", leadTasks.stream().filter(t -> !"Completed".equals(t.getStatus())).toList());
        body.put("closedActivities", leadTasks.stream().filter(t -> "Completed".equals(t.getStatus())).toList());
        body.put("calls", timeline.stream().filter(a -> "call".equals(a.getType())).toList());
        body.put("emails", timeline.stream().filter(a -> "email".equals(a.getType())).toList());
        body.put("attachments", attachments.findByLeadIdOrderByCreatedAtDesc(id));
        body.put("contact", lead.getConvertedContactId() == null ? null
                : contacts.findById(lead.getConvertedContactId()).orElse(null));
        body.put("timeline", timeline);
        return body;
    }

    public Map<String, Object> activitiesFor(String id) {
        Map<String, Object> all = related(id);
        return Map.of("open", all.get("openActivities"), "closed", all.get("closedActivities"), "calls", all.get("calls"));
    }

    public List<Activity> timeline(String id) {
        leadService.get(id);
        return activities.forLead(id);
    }

    public Lead tags(String id, TagsRequest request) {
        Lead lead = owned(id);
        List<String> clean = request.tags() == null ? List.of() : request.tags().stream()
                .map(String::trim).filter(tag -> !tag.isBlank()).distinct().toList();
        lead.setTags(new ArrayList<>(clean));
        lead.setUpdatedAt(Instant.now());
        leads.save(lead);
        return leadService.get(id);
    }

    public Map<String, Object> convert(String id) {
        Lead lead = owned(id);
        if (lead.getConvertedContactId() != null && !lead.getConvertedContactId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This lead was already converted to a contact");
        }
        boolean student = "Student".equals(lead.getLeadType());
        String person = student || blank(lead.getContactPerson()) ? lead.getName() : lead.getContactPerson();
        Contact contact = new Contact();
        contact.setWorkspaceId(lead.getWorkspaceId());
        contact.setOwnerId(scope.id());
        contact.setName(person);
        contact.setTitle(student ? "Student" : "");
        contact.setCompany(nullToEmpty(lead.getCompany()));
        contact.setEmail(nullToEmpty(lead.getEmail()));
        contact.setPhone(blank(lead.getPhone()) ? nullToEmpty(lead.getMobile()) : lead.getPhone());
        List<String> tags = new ArrayList<>(lead.getTags() == null ? List.of() : lead.getTags());
        if (!blank(lead.getLeadType()) && !tags.contains(lead.getLeadType())) tags.add(lead.getLeadType());
        contact.setTags(tags);
        contact.setCreatedAt(Instant.now());
        contacts.save(contact);
        String previousStage = lead.getStage();
        lead.setConvertedContactId(contact.getId());
        lead.setConvertedAt(Instant.now());
        lead.setUpdatedAt(Instant.now());
        if (!Catalog.isWon(previousStage)) {
            lead.setStage(Catalog.CONVERTED);
            lead.setCloseReason("");
            lead.setCloseNote("");
            lead.setClosedAt(Instant.now());
        }
        leads.save(lead);
        activities.log(lead, scope.user(), "converted", "Converted to contact", person + " is now in Contacts.");
        if (!Catalog.isWon(previousStage)) {
            activities.log(lead, scope.user(), "stage", "Moved to " + Catalog.CONVERTED,
                    previousStage + " → " + Catalog.CONVERTED);
        }
        return Map.of("lead", leadService.get(id), "contact", contact);
    }

    public Attachment upload(String id, AttachmentRequest request) {
        Lead lead = owned(id);
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(request.data());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The file could not be read");
        }
        if (bytes.length > MAX_ATTACHMENT_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Attachments must be 5 MB or smaller");
        }
        Attachment file = new Attachment();
        file.setWorkspaceId(lead.getWorkspaceId());
        file.setLeadId(lead.getId());
        file.setFileName(request.fileName().trim());
        file.setContentType(blank(request.contentType()) ? "application/octet-stream" : request.contentType());
        file.setSize(bytes.length);
        file.setData(request.data());
        file.setUploadedBy(scope.user().getName());
        file.setCreatedAt(Instant.now());
        attachments.save(file);
        activities.log(lead, scope.user(), "attachment", "Attachment added", file.getFileName());
        return file;
    }

    public Map<String, Object> download(String id, String attachmentId) {
        Attachment file = ownedAttachment(id, attachmentId);
        return Map.of("fileName", file.getFileName(), "contentType", file.getContentType(), "data", file.getData());
    }

    public void deleteAttachment(String id, String attachmentId) {
        attachments.delete(ownedAttachment(id, attachmentId));
    }

    private Attachment ownedAttachment(String leadId, String attachmentId) {
        owned(leadId);
        return attachments.findById(attachmentId)
                .filter(file -> leadId.equals(file.getLeadId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found"));
    }

    private Lead owned(String id) {
        return leads.findById(id)
                .filter(lead -> scope.canSee(lead.getWorkspaceId(), lead.getOwnerId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lead not found"));
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    public record TagsRequest(List<String> tags) {
    }

    public record AttachmentRequest(
            @NotBlank(message = "File name is required") String fileName,
            String contentType,
            @NotBlank(message = "The file is empty") String data) {
    }
}
