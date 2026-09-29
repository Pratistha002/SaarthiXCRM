package com.saarthix.crm.web;

import com.saarthix.crm.model.Contact;
import com.saarthix.crm.model.FollowUp;
import com.saarthix.crm.model.Note;
import com.saarthix.crm.service.ContactService;
import com.saarthix.crm.service.FollowUpService;
import com.saarthix.crm.service.NoteService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class WorkspaceController {
    private final ContactService contacts;
    private final NoteService notes;
    private final FollowUpService tasks;

    public WorkspaceController(ContactService contacts, NoteService notes, FollowUpService tasks) {
        this.contacts = contacts;
        this.notes = notes;
        this.tasks = tasks;
    }

    @GetMapping("/api/contacts")
    public Map<String, Object> contacts(@RequestParam(required = false) String q,
                                        @RequestParam(required = false) String tag,
                                        @RequestParam(required = false) Boolean favorite) {
        return contacts.list(q, tag, favorite);
    }

    @PostMapping("/api/contacts")
    public Contact createContact(@Valid @RequestBody ContactService.ContactRequest request) {
        return contacts.create(request);
    }

    @PutMapping("/api/contacts/{id}")
    public Contact updateContact(@PathVariable String id, @Valid @RequestBody ContactService.ContactRequest request) {
        return contacts.update(id, request);
    }

    @PatchMapping("/api/contacts/{id}/favorite")
    public Contact favorite(@PathVariable String id) {
        return contacts.favorite(id);
    }

    @DeleteMapping("/api/contacts/{id}")
    public void deleteContact(@PathVariable String id) {
        contacts.delete(id);
    }

    @GetMapping("/api/notes")
    public Map<String, Object> notes(@RequestParam(required = false) String q,
                                     @RequestParam(required = false) String filter,
                                     @RequestParam(required = false) String leadId) {
        return notes.list(q, filter, leadId);
    }

    @PostMapping("/api/notes")
    public Note createNote(@Valid @RequestBody NoteService.NoteRequest request) {
        return notes.create(request);
    }

    @PutMapping("/api/notes/{id}")
    public Note updateNote(@PathVariable String id, @Valid @RequestBody NoteService.NoteRequest request) {
        return notes.update(id, request);
    }

    @PatchMapping("/api/notes/{id}/pin")
    public Note pin(@PathVariable String id) {
        return notes.pin(id);
    }

    @DeleteMapping("/api/notes/{id}")
    public void deleteNote(@PathVariable String id) {
        notes.delete(id);
    }

    @GetMapping("/api/followups")
    public Map<String, Object> tasks(@RequestParam(required = false) String filter) {
        return tasks.list(filter);
    }

    @PostMapping("/api/followups")
    public FollowUp createTask(@Valid @RequestBody FollowUpService.TaskRequest request) {
        return tasks.create(request);
    }

    @PutMapping("/api/followups/{id}")
    public FollowUp updateTask(@PathVariable String id, @Valid @RequestBody FollowUpService.TaskRequest request) {
        return tasks.update(id, request);
    }

    @PatchMapping("/api/followups/{id}/status")
    public FollowUp status(@PathVariable String id, @Valid @RequestBody FollowUpService.StatusRequest request) {
        return tasks.status(id, request);
    }

    @PostMapping("/api/followups/{id}/approve")
    public FollowUp approve(@PathVariable String id) {
        return tasks.approve(id);
    }

    @DeleteMapping("/api/followups/{id}")
    public void deleteTask(@PathVariable String id) {
        tasks.delete(id);
    }
}
