package com.saarthix.crm.web;

import com.saarthix.crm.model.Account;
import com.saarthix.crm.model.Attachment;
import com.saarthix.crm.model.Contact;
import com.saarthix.crm.model.Deal;
import com.saarthix.crm.model.FollowUp;
import com.saarthix.crm.repo.ContactRepository;
import com.saarthix.crm.repo.DealRepository;
import com.saarthix.crm.security.Scope;
import com.saarthix.crm.service.AccountService;
import com.saarthix.crm.service.AttachmentService;
import com.saarthix.crm.service.CallService;
import com.saarthix.crm.service.DealService;
import com.saarthix.crm.service.FollowUpService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
public class DealController {
    private final DealService deals;
    private final CallService calls;
    private final FollowUpService followUps;
    private final AccountService accounts;
    private final ContactRepository contacts;
    private final DealRepository dealRepo;
    private final Scope scope;

    public DealController(DealService deals, CallService calls, FollowUpService followUps, AccountService accounts,
                          ContactRepository contacts, DealRepository dealRepo, Scope scope) {
        this.deals = deals;
        this.calls = calls;
        this.followUps = followUps;
        this.accounts = accounts;
        this.contacts = contacts;
        this.dealRepo = dealRepo;
        this.scope = scope;
    }

    @GetMapping("/api/deals/meta")
    public Map<String, Object> meta() {
        return deals.meta();
    }

    @GetMapping("/api/deals")
    public Map<String, Object> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String owner,
            @RequestParam(required = false) String account,
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) String product,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String closeFrom,
            @RequestParam(required = false) String closeTo,
            @RequestParam(required = false) Long minValue,
            @RequestParam(required = false) Long maxValue,
            @RequestParam(required = false) String closedFrom,
            @RequestParam(required = false) String closedTo) {
        return deals.list(new DealService.Filter(q, owner, account, stage, product, priority,
                closeFrom, closeTo, minValue, maxValue, closedFrom, closedTo));
    }

    @GetMapping("/api/deals/{id}")
    public Map<String, Object> detail(@PathVariable String id) {
        return deals.detail(id);
    }

    @PutMapping("/api/deals/{id}")
    public Deal update(@PathVariable String id, @RequestBody DealService.DealRequest request) {
        return deals.update(id, request);
    }

    @PatchMapping("/api/deals/{id}/stage")
    public Deal stage(@PathVariable String id, @RequestBody DealService.StageRequest request) {
        return deals.move(id, request);
    }

    @PostMapping("/api/deals/{id}/activities/call")
    public Map<String, Object> call(@PathVariable String id, @RequestBody CallService.CallRequest request) {
        return calls.logForDeal(id, request);
    }

    @PostMapping("/api/deals/{id}/tasks")
    public FollowUp task(@PathVariable String id, @Valid @RequestBody FollowUpService.TaskRequest request) {
        return followUps.createForDeal(id, request);
    }

    @PostMapping("/api/deals/{id}/attachments")
    public Attachment upload(@PathVariable String id, @Valid @RequestBody AttachmentService.AttachmentRequest request) {
        return deals.upload(id, request);
    }

    @GetMapping("/api/deals/{id}/attachments/{attachmentId}")
    public Map<String, Object> download(@PathVariable String id, @PathVariable String attachmentId) {
        return deals.download(id, attachmentId);
    }

    @DeleteMapping("/api/deals/{id}/attachments/{attachmentId}")
    public void deleteAttachment(@PathVariable String id, @PathVariable String attachmentId) {
        deals.deleteAttachment(id, attachmentId);
    }

    @GetMapping("/api/accounts")
    public List<Account> accounts() {
        return accounts.list();
    }

    @GetMapping("/api/accounts/{id}")
    public Map<String, Object> account(@PathVariable String id) {
        Map<String, Object> body = accounts.detail(id);
        @SuppressWarnings("unchecked")
        List<Deal> rows = (List<Deal>) body.get("deals");
        deals.decorate(rows);
        return body;
    }

    @GetMapping("/api/contacts/{id}")
    public Map<String, Object> contact(@PathVariable String id) {
        Contact contact = contacts.findById(id)
                .filter(c -> scope.sameWorkspace(c.getWorkspaceId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found"));
        List<Deal> rows = dealRepo.findByWorkspaceIdAndPrimaryContactId(scope.workspaceId(), id).stream()
                .sorted(Comparator.comparing(Deal::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        deals.decorate(rows);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("contact", contact);
        body.put("account", contact.getAccountId() == null ? null : accounts.owned(contact.getAccountId()));
        body.put("deals", rows);
        return body;
    }
}
