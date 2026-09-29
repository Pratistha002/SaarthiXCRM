package com.saarthix.crm.service;

import com.saarthix.crm.model.Note;
import com.saarthix.crm.repo.DealRepository;
import com.saarthix.crm.repo.LeadRepository;
import com.saarthix.crm.repo.NoteRepository;
import com.saarthix.crm.security.Scope;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class NoteService {
    private final NoteRepository notes;
    private final LeadRepository leads;
    private final DealRepository deals;
    private final ActivityService activities;
    private final Scope scope;

    public NoteService(NoteRepository notes, LeadRepository leads, DealRepository deals, ActivityService activities, Scope scope) {
        this.notes = notes;
        this.leads = leads;
        this.deals = deals;
        this.activities = activities;
        this.scope = scope;
    }

    public Map<String, Object> list(String q, String filter, String leadId) {
        List<Note> all = visibleNotes();
        String query = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        String mode = filter == null ? "All" : filter;
        String lead = leadId == null ? "" : leadId.trim();
        List<Note> filtered = all.stream()
                .filter(n -> query.isEmpty()
                        || contains(n.getBody(), query)
                        || contains(n.getLinkedName(), query)
                        || contains(n.getAuthorName(), query))
                .filter(n -> lead.isEmpty()
                        || ("lead".equals(n.getLinkedType()) && lead.equals(n.getLinkedId())))
                .filter(n -> switch (mode) {
                    case "Pinned" -> n.isPinned();
                    case "Linked" -> n.getLinkedId() != null && !n.getLinkedId().isBlank();
                    case "Unlinked" -> n.getLinkedId() == null || n.getLinkedId().isBlank();
                    default -> true;
                })
                .sorted(Comparator.comparing(Note::isPinned).reversed()
                        .thenComparing(Note::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        long pinned = all.stream().filter(Note::isPinned).count();
        long linked = all.stream().filter(n -> n.getLinkedId() != null && !n.getLinkedId().isBlank()).count();
        return Map.of(
                "notes", filtered,
                "summary", Map.of(
                        "total", all.size(),
                        "pinned", pinned,
                        "linked", linked,
                        "unlinked", all.size() - linked));
    }

    public Note create(NoteRequest request) {
        Note note = new Note();
        note.setWorkspaceId(scope.workspaceId());
        note.setOwnerId(scope.id());
        note.setAuthorName(scope.user().getName());
        note.setCreatedAt(Instant.now());
        apply(note, request);
        if ("lead".equals(note.getLinkedType()) && note.getLinkedId() != null && !note.getLinkedId().isBlank()) {
            leads.findById(note.getLinkedId())
                    .filter(lead -> scope.canSee(lead.getWorkspaceId(), lead.getOwnerId()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lead not found"));
        }
        notes.save(note);
        if ("lead".equals(note.getLinkedType()) && note.getLinkedId() != null && !note.getLinkedId().isBlank()) {
            leads.findById(note.getLinkedId())
                    .ifPresent(lead -> activities.log(lead, scope.user(), "note", "Note added", note.getBody()));
        }
        if ("deal".equals(note.getLinkedType()) && note.getLinkedId() != null && !note.getLinkedId().isBlank()) {
            deals.findById(note.getLinkedId())
                    .filter(deal -> scope.sameWorkspace(deal.getWorkspaceId()))
                    .ifPresent(deal -> activities.logDeal(deal, scope.user(), "note", "Note added", note.getBody()));
        }
        return note;
    }

    public Note update(String id, NoteRequest request) {
        Note note = owned(id);
        apply(note, request);
        return notes.save(note);
    }

    public Note pin(String id) {
        Note note = owned(id);
        note.setPinned(!note.isPinned());
        return notes.save(note);
    }

    public void delete(String id) {
        notes.delete(owned(id));
    }

    private void apply(Note note, NoteRequest request) {
        note.setBody(request.body().trim());
        note.setPinned(request.pinned() != null && request.pinned());
        note.setLinkedType(request.linkedType() == null ? "" : request.linkedType());
        note.setLinkedId(request.linkedId() == null ? "" : request.linkedId());
        note.setLinkedName(request.linkedName() == null ? "" : request.linkedName());
    }

    private List<Note> visibleNotes() {
        if (scope.isPlatformAdmin()) return notes.findAll();
        List<Note> all = notes.findByWorkspaceId(scope.workspaceId());
        if (scope.seesTeamData()) return all;
        String me = scope.id();
        java.util.Set<String> leadIds = leads.findByWorkspaceIdAndOwnerId(scope.workspaceId(), me).stream()
                .map(com.saarthix.crm.model.Lead::getId)
                .collect(java.util.stream.Collectors.toSet());
        return all.stream()
                .filter(n -> me.equals(n.getOwnerId())
                        || (n.getLinkedId() != null && !n.getLinkedId().isBlank() && leadIds.contains(n.getLinkedId())))
                .toList();
    }

    private Note owned(String id) {
        return notes.findById(id)
                .filter(this::canSeeNote)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Note not found"));
    }

    private boolean canSeeNote(Note note) {
        if (scope.canSee(note.getWorkspaceId(), note.getOwnerId())) return true;
        if (note.getLinkedId() == null || note.getLinkedId().isBlank()) return false;
        return leads.findById(note.getLinkedId())
                .filter(lead -> scope.canSee(lead.getWorkspaceId(), lead.getOwnerId()))
                .isPresent();
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }

    public record NoteRequest(
            @NotBlank(message = "Write a note before saving") String body,
            Boolean pinned,
            String linkedType,
            String linkedId,
            String linkedName) {
    }
}
