package com.saarthix.crm.service;

import com.saarthix.crm.domain.Catalog;
import com.saarthix.crm.model.Account;
import com.saarthix.crm.model.Contact;
import com.saarthix.crm.model.Deal;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.repo.AccountRepository;
import com.saarthix.crm.repo.ContactRepository;
import com.saarthix.crm.repo.DealRepository;
import com.saarthix.crm.security.Scope;
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
public class AccountService {
    private final AccountRepository accounts;
    private final ContactRepository contacts;
    private final DealRepository deals;
    private final Scope scope;

    public AccountService(AccountRepository accounts, ContactRepository contacts, DealRepository deals, Scope scope) {
        this.accounts = accounts;
        this.contacts = contacts;
        this.deals = deals;
        this.scope = scope;
    }

    public static String key(String name) {
        return name == null ? "" : name.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    /** Returns the workspace account with this name, creating it from the lead's details only if none exists. */
    public Account findOrCreate(String name, Lead source) {
        String clean = name == null ? "" : name.trim().replaceAll("\\s+", " ");
        if (clean.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Account name is required");
        String workspace = scope.workspaceId();
        return accounts.findFirstByWorkspaceIdAndNameKey(workspace, key(clean)).orElseGet(() -> {
            Account account = new Account();
            account.setWorkspaceId(workspace);
            account.setName(clean);
            account.setNameKey(key(clean));
            account.setOwnerId(scope.id());
            if (source != null) {
                account.setType(source.getLeadType());
                account.setWebsite(source.getWebsite());
                account.setPhone(source.getPhone());
                account.setIndustry(source.getIndustry());
                account.setCity(source.getCity());
                account.setState(source.getState());
                account.setCountry(source.getCountry());
            }
            account.setCreatedAt(Instant.now());
            account.setUpdatedAt(Instant.now());
            return accounts.save(account);
        });
    }

    public List<Account> list() {
        return accounts.findByWorkspaceId(scope.workspaceId()).stream()
                .sorted(Comparator.comparing(Account::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    public Map<String, Object> detail(String id) {
        Account account = owned(id);
        String workspace = scope.workspaceId();
        List<Deal> accountDeals = deals.findByWorkspaceIdAndAccountId(workspace, id).stream()
                .sorted(Comparator.comparing(Deal::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        List<Contact> people = contacts.findByWorkspaceIdAndAccountId(workspace, id).stream()
                .sorted(Comparator.comparing(Contact::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("openValue", accountDeals.stream().filter(d -> "Open".equals(d.getStatus())).mapToLong(Deal::getValue).sum());
        summary.put("wonValue", accountDeals.stream().filter(d -> Catalog.DEAL_WON.equals(d.getStatus())).mapToLong(Deal::getValue).sum());
        summary.put("openDeals", accountDeals.stream().filter(d -> "Open".equals(d.getStatus())).count());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("account", account);
        body.put("contacts", people);
        body.put("deals", accountDeals);
        body.put("summary", summary);
        return body;
    }

    public Account owned(String id) {
        return accounts.findById(id)
                .filter(account -> scope.sameWorkspace(account.getWorkspaceId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
    }
}
