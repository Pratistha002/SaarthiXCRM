package com.saarthix.crm.service;

import com.saarthix.crm.model.Contact;
import com.saarthix.crm.repo.ContactRepository;
import com.saarthix.crm.repo.NoteRepository;
import com.saarthix.crm.security.Scope;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class ContactService {
    private final ContactRepository contacts;
    private final NoteRepository notes;
    private final Scope scope;

    public ContactService(ContactRepository contacts, NoteRepository notes, Scope scope) {
        this.contacts = contacts;
        this.notes = notes;
        this.scope = scope;
    }

    public Map<String, Object> list(String q, String tag, Boolean favorite) {
        List<Contact> all = contacts.findByWorkspaceId(scope.workspaceId());
        String query = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        List<Contact> filtered = all.stream()
                .filter(c -> query.isEmpty()
                        || contains(c.getName(), query)
                        || contains(c.getEmail(), query)
                        || contains(c.getCompany(), query))
                .filter(c -> tag == null || tag.isBlank() || "All".equalsIgnoreCase(tag)
                        || (c.getTags() != null && c.getTags().stream().anyMatch(t -> t.equalsIgnoreCase(tag))))
                .filter(c -> favorite == null || !favorite || c.isFavorite())
                .sorted(Comparator.comparing(Contact::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
        Map<String, Long> tags = new LinkedHashMap<>();
        all.stream().flatMap(c -> c.getTags() == null ? java.util.stream.Stream.<String>empty() : c.getTags().stream())
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .forEach(t -> tags.merge(t, 1L, Long::sum));
        long companies = all.stream().map(Contact::getCompany).filter(s -> s != null && !s.isBlank()).distinct().count();
        long tagged = all.stream().filter(c -> c.getTags() != null && !c.getTags().isEmpty()).count();
        long favorites = all.stream().filter(Contact::isFavorite).count();
        return Map.of(
                "contacts", filtered,
                "summary", Map.of(
                        "total", all.size(),
                        "favorites", favorites,
                        "companies", companies,
                        "tagged", tagged,
                        "tags", tags));
    }

    public Contact create(ContactRequest request) {
        Contact contact = new Contact();
        contact.setWorkspaceId(scope.workspaceId());
        contact.setOwnerId(scope.id());
        contact.setCreatedAt(Instant.now());
        apply(contact, request);
        return contacts.save(contact);
    }

    public Contact update(String id, ContactRequest request) {
        Contact contact = owned(id);
        String previous = contact.getName();
        apply(contact, request);
        contacts.save(contact);
        if (!previous.equals(contact.getName())) {
            notes.findByWorkspaceIdAndLinkedId(scope.workspaceId(), id).forEach(note -> {
                note.setLinkedName(contact.getName());
                notes.save(note);
            });
        }
        return contact;
    }

    public Contact favorite(String id) {
        Contact contact = owned(id);
        contact.setFavorite(!contact.isFavorite());
        return contacts.save(contact);
    }

    public void delete(String id) {
        contacts.delete(owned(id));
    }

    private void apply(Contact contact, ContactRequest request) {
        contact.setName(request.name().trim());
        contact.setTitle(request.title() == null ? "" : request.title().trim());
        contact.setCompany(request.company() == null ? "" : request.company().trim());
        contact.setEmail(request.email() == null ? "" : request.email().trim());
        contact.setPhone(request.phone() == null ? "" : request.phone().trim());
        contact.setTags(request.tags() == null ? List.of() : request.tags().stream()
                .map(String::trim).filter(s -> !s.isBlank()).distinct().toList());
        contact.setFavorite(request.favorite() != null && request.favorite());
    }

    private Contact owned(String id) {
        return contacts.findById(id)
                .filter(c -> scope.sameWorkspace(c.getWorkspaceId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found"));
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }

    public record ContactRequest(
            @NotBlank(message = "Name is required") String name,
            String title,
            String company,
            String email,
            String phone,
            List<String> tags,
            Boolean favorite) {
    }
}
