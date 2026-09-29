package com.saarthix.crm.service;

import com.saarthix.crm.domain.Catalog;
import com.saarthix.crm.model.Account;
import com.saarthix.crm.model.Activity;
import com.saarthix.crm.model.Attachment;
import com.saarthix.crm.model.Contact;
import com.saarthix.crm.model.Deal;
import com.saarthix.crm.model.FollowUp;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.model.Note;
import com.saarthix.crm.repo.AttachmentRepository;
import com.saarthix.crm.repo.ContactRepository;
import com.saarthix.crm.repo.DealRepository;
import com.saarthix.crm.repo.FollowUpRepository;
import com.saarthix.crm.repo.LeadRepository;
import com.saarthix.crm.repo.NoteRepository;
import com.saarthix.crm.security.Scope;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class LeadDetailService {
    private final LeadRepository leads;
    private final NoteRepository notes;
    private final FollowUpRepository tasks;
    private final ContactRepository contacts;
    private final AttachmentRepository attachments;
    private final AttachmentService attachmentService;
    private final AccountService accountService;
    private final DealService dealService;
    private final DealRepository deals;
    private final ActivityService activities;
    private final LeadService leadService;
    private final Scope scope;

    public LeadDetailService(LeadRepository leads, NoteRepository notes, FollowUpRepository tasks,
                             ContactRepository contacts, AttachmentRepository attachments,
                             AttachmentService attachmentService, AccountService accountService,
                             DealService dealService, DealRepository deals,
                             ActivityService activities, LeadService leadService, Scope scope) {
        this.leads = leads;
        this.notes = notes;
        this.tasks = tasks;
        this.contacts = contacts;
        this.attachments = attachments;
        this.attachmentService = attachmentService;
        this.accountService = accountService;
        this.dealService = dealService;
        this.deals = deals;
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
        body.put("contacts", contactsOf(lead));
        body.put("account", lead.getConvertedAccountId() == null ? null
                : accountService.owned(lead.getConvertedAccountId()));
        body.put("deal", lead.getConvertedDealId() == null ? null
                : deals.findById(lead.getConvertedDealId()).orElse(null));
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

    /**
     * Converts a lead: links or creates the Account and Contact (never duplicating either) and, when there is a real
     * opportunity, creates the Deal in the first pipeline stage. A lead converted before deals existed can come back
     * here once to get its deal.
     */
    public Map<String, Object> convert(String id, ConvertRequest request) {
        Lead lead = owned(id);
        if (!blank(lead.getConvertedDealId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This lead was already converted");
        }
        boolean alreadyConverted = !blank(lead.getConvertedContactId());
        boolean createDeal = request == null || request.createDeal() == null || request.createDeal();
        if (alreadyConverted && !createDeal) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This lead was already converted to a contact");
        }
        boolean student = "Student".equals(lead.getLeadType());
        String defaultPerson = student || blank(lead.getContactPerson()) ? lead.getName() : lead.getContactPerson();
        String accountName = request == null || blank(request.accountName()) ? lead.getCompany() : request.accountName();
        if (blank(accountName)) accountName = lead.getName();
        String person = request == null || blank(request.contactName()) ? defaultPerson : request.contactName().trim();
        List<PersonRequest> people = request == null || request.contacts() == null ? List.of() : request.contacts().stream()
                .filter(Objects::nonNull)
                .filter(p -> !blank(p.name()) || !blank(p.email()) || !blank(p.phone()) || !blank(p.title()))
                .toList();
        if (people.isEmpty()) {
            people = List.of(new PersonRequest(person, student ? "Student" : "", lead.getEmail(),
                    blank(lead.getPhone()) ? lead.getMobile() : lead.getPhone()));
        }
        if (!alreadyConverted) {
            for (PersonRequest p : people) {
                if (blank(p.name())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Every point of contact needs a name");
                if (!blank(p.email()) && !p.email().trim().matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid email for " + p.name().trim());
                }
            }
        }

        Account account = accountService.findOrCreate(accountName, lead);
        List<Contact> linked = new ArrayList<>();
        if (alreadyConverted) {
            PersonRequest primary = people.get(0);
            linked.add(contacts.findById(lead.getConvertedContactId()).orElseGet(() -> linkContact(lead, account, primary, student)));
            contactsOf(lead).stream().filter(c -> linked.stream().noneMatch(l -> l.getId().equals(c.getId()))).forEach(linked::add);
        } else {
            for (PersonRequest p : people) {
                Contact c = linkContact(lead, account, p, student);
                if (linked.stream().noneMatch(l -> l.getId().equals(c.getId()))) linked.add(c);
            }
            contactsOf(lead).stream().filter(c -> linked.stream().noneMatch(l -> l.getId().equals(c.getId()))).forEach(linked::add);
        }
        for (Contact c : linked) {
            if (!Objects.equals(c.getAccountId(), account.getId()) && blank(c.getAccountId())) {
                c.setAccountId(account.getId());
                if (blank(c.getCompany())) c.setCompany(account.getName());
                contacts.save(c);
            }
        }
        Contact contact = linked.get(0);

        Deal deal = null;
        if (createDeal) {
            NewDealRequest d = request == null ? null : request.deal();
            String product = d == null || blank(d.product()) ? Catalog.PRODUCTS.get(0) : d.product().trim();
            deal = dealService.createFromLead(lead, account, contact, new DealService.NewDeal(
                    d == null || blank(d.name()) ? account.getName() + " - " + product : d.name(),
                    product,
                    d == null || d.value() == null ? lead.getValue() : d.value(),
                    d == null ? null : d.expectedCloseDate(),
                    d == null ? null : d.priority(),
                    d == null ? null : d.ownerId()));
        }

        String previousStage = lead.getStage();
        Instant now = Instant.now();
        lead.setConvertedContactId(contact.getId());
        lead.setContactIds(new ArrayList<>(linked.stream().map(Contact::getId).toList()));
        lead.setConvertedAccountId(account.getId());
        lead.setConvertedDealId(deal == null ? null : deal.getId());
        if (lead.getConvertedAt() == null) lead.setConvertedAt(now);
        lead.setUpdatedAt(now);
        if (!Catalog.isWon(previousStage)) {
            lead.setStage(Catalog.CONVERTED);
            lead.setCloseReason("");
            lead.setCloseNote("");
            lead.setClosedAt(now);
        }
        leads.save(lead);
        String summary = "Account: " + account.getName()
                + (linked.size() == 1 ? " · Contact: " : " · Contacts: ")
                + String.join(", ", linked.stream().map(Contact::getName).toList())
                + (deal == null ? "" : " · Deal: " + deal.getName() + " (" + DealService.inr(deal.getValue()) + ")");
        activities.log(lead, scope.user(), "converted", alreadyConverted ? "Deal created from lead" : "Lead converted", summary);
        if (!Catalog.isWon(previousStage)) {
            activities.logStage(lead, scope.user(), previousStage, Catalog.CONVERTED,
                    previousStage + " → " + Catalog.CONVERTED, "Converted · " + summary);
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("lead", leadService.get(id));
        body.put("account", account);
        body.put("contact", contact);
        body.put("contacts", linked);
        body.put("deal", deal);
        return body;
    }

    /** Adds a point of contact to the lead. Before conversion it has no account yet; conversion attaches one. */
    public Contact addContact(String id, PersonRequest request) {
        Lead lead = owned(id);
        if (request == null || blank(request.name())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name is required");
        }
        if (!blank(request.email()) && !request.email().trim().matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid email");
        }
        Account account = blank(lead.getConvertedAccountId()) ? null : accountService.owned(lead.getConvertedAccountId());
        PersonRequest person = new PersonRequest(request.name().trim(), request.title(), request.email(), request.phone());
        Contact contact = linkContact(lead, account, person, "Student".equals(lead.getLeadType()));
        List<Contact> current = contactsOf(lead);
        if (current.stream().anyMatch(c -> c.getId().equals(contact.getId()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, contact.getName() + " is already a point of contact for this lead");
        }
        if (account != null && blank(contact.getAccountId())) {
            contact.setAccountId(account.getId());
            contact.setCompany(account.getName());
            contacts.save(contact);
        }
        List<String> ids = new ArrayList<>(current.stream().map(Contact::getId).toList());
        ids.add(contact.getId());
        lead.setContactIds(ids);
        lead.setUpdatedAt(Instant.now());
        leads.save(lead);
        activities.log(lead, scope.user(), "contact", "Point of contact added",
                contact.getName() + (blank(contact.getTitle()) ? "" : " · " + contact.getTitle()));
        return contact;
    }

    /** Points of contact created at conversion, primary first. Leads converted earlier only have the primary one. */
    private List<Contact> contactsOf(Lead lead) {
        List<String> ids = new ArrayList<>(lead.getContactIds() == null ? List.of() : lead.getContactIds());
        if (!blank(lead.getConvertedContactId()) && !ids.contains(lead.getConvertedContactId())) {
            ids.add(0, lead.getConvertedContactId());
        }
        Map<String, Contact> found = new LinkedHashMap<>();
        contacts.findAllById(ids).forEach(c -> found.put(c.getId(), c));
        return ids.stream().map(found::get).filter(Objects::nonNull).toList();
    }

    /** Reuses a contact with the same email, or the same name at this account, before creating a new one. */
    private Contact linkContact(Lead lead, Account account, PersonRequest details, boolean student) {
        String workspace = lead.getWorkspaceId();
        String person = nullToEmpty(details.name());
        String email = nullToEmpty(details.email()).toLowerCase(java.util.Locale.ROOT);
        List<Contact> all = contacts.findByWorkspaceId(workspace);
        java.util.Optional<Contact> match = all.stream()
                .filter(c -> !email.isBlank() && email.equalsIgnoreCase(nullToEmpty(c.getEmail())))
                .findFirst();
        if (match.isEmpty() && account != null) {
            match = all.stream()
                    .filter(c -> person.equalsIgnoreCase(nullToEmpty(c.getName())))
                    .filter(c -> account.getId().equals(c.getAccountId())
                            || (blank(c.getAccountId()) && AccountService.key(c.getCompany()).equals(account.getNameKey())))
                    .findFirst();
        }
        if (match.isPresent()) {
            Contact existing = match.get();
            boolean changed = false;
            if (blank(existing.getTitle()) && !blank(details.title())) { existing.setTitle(details.title().trim()); changed = true; }
            if (blank(existing.getEmail()) && !email.isBlank()) { existing.setEmail(nullToEmpty(details.email())); changed = true; }
            if (blank(existing.getPhone()) && !blank(details.phone())) { existing.setPhone(details.phone().trim()); changed = true; }
            return changed ? contacts.save(existing) : existing;
        }
        Contact contact = new Contact();
        contact.setWorkspaceId(workspace);
        contact.setOwnerId(blank(lead.getOwnerId()) ? scope.id() : lead.getOwnerId());
        contact.setName(person);
        contact.setTitle(blank(details.title()) ? (student ? "Student" : "") : details.title().trim());
        contact.setCompany(account != null ? account.getName() : nullToEmpty(blank(lead.getCompany()) ? lead.getName() : lead.getCompany()));
        contact.setAccountId(account != null ? account.getId() : null);
        contact.setEmail(nullToEmpty(details.email()));
        contact.setPhone(nullToEmpty(details.phone()));
        List<String> tags = new ArrayList<>(lead.getTags() == null ? List.of() : lead.getTags());
        if (!blank(lead.getLeadType()) && !tags.contains(lead.getLeadType())) tags.add(lead.getLeadType());
        contact.setTags(tags);
        contact.setCreatedAt(Instant.now());
        return contacts.save(contact);
    }

    public Attachment upload(String id, AttachmentService.AttachmentRequest request) {
        Lead lead = owned(id);
        Attachment file = attachmentService.store(lead.getWorkspaceId(), lead.getId(), null, request);
        activities.log(lead, scope.user(), "attachment", "Attachment added", file.getFileName());
        return file;
    }

    public Map<String, Object> download(String id, String attachmentId) {
        owned(id);
        return attachmentService.download(attachmentService.find(attachmentId, file -> id.equals(file.getLeadId())));
    }

    public void deleteAttachment(String id, String attachmentId) {
        owned(id);
        attachmentService.delete(attachmentService.find(attachmentId, file -> id.equals(file.getLeadId())));
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

    public record ConvertRequest(String accountName, String contactName, List<PersonRequest> contacts, Boolean createDeal,
                                 NewDealRequest deal) {
    }

    public record PersonRequest(String name, String title, String email, String phone) {
    }

    public record NewDealRequest(String name, String product, Long value, String expectedCloseDate, String priority,
                                 String ownerId) {
    }
}
