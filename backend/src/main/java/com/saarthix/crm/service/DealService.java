package com.saarthix.crm.service;

import com.saarthix.crm.domain.Catalog;
import com.saarthix.crm.model.Account;
import com.saarthix.crm.model.Activity;
import com.saarthix.crm.model.Attachment;
import com.saarthix.crm.model.Contact;
import com.saarthix.crm.model.Deal;
import com.saarthix.crm.model.FollowUp;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.model.User;
import com.saarthix.crm.repo.AccountRepository;
import com.saarthix.crm.repo.AttachmentRepository;
import com.saarthix.crm.repo.ContactRepository;
import com.saarthix.crm.repo.DealRepository;
import com.saarthix.crm.repo.FollowUpRepository;
import com.saarthix.crm.repo.NoteRepository;
import com.saarthix.crm.repo.UserRepository;
import com.saarthix.crm.security.Scope;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TreeSet;
import java.util.function.Predicate;
import java.util.stream.Collectors;

@Service
public class DealService {
    private final DealRepository deals;
    private final AccountRepository accounts;
    private final ContactRepository contacts;
    private final FollowUpRepository tasks;
    private final NoteRepository notes;
    private final AttachmentRepository attachmentRepo;
    private final AttachmentService attachments;
    private final UserRepository users;
    private final ActivityService activities;
    private final Scope scope;

    public DealService(DealRepository deals, AccountRepository accounts, ContactRepository contacts,
                       FollowUpRepository tasks, NoteRepository notes, AttachmentRepository attachmentRepo,
                       AttachmentService attachments, UserRepository users, ActivityService activities, Scope scope) {
        this.deals = deals;
        this.accounts = accounts;
        this.contacts = contacts;
        this.tasks = tasks;
        this.notes = notes;
        this.attachmentRepo = attachmentRepo;
        this.attachments = attachments;
        this.users = users;
        this.activities = activities;
        this.scope = scope;
    }

    public Map<String, Object> meta() {
        List<Map<String, Object>> stages = Catalog.DEAL_STAGES.stream().map(stage -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", stage);
            row.put("probability", Catalog.DEAL_PROBABILITY.get(stage));
            row.put("active", Catalog.DEAL_ACTIVE_STAGES.contains(stage));
            return row;
        }).toList();
        TreeSet<String> products = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        products.addAll(Catalog.PRODUCTS);
        deals.findByWorkspaceId(scope.workspaceId()).stream()
                .map(Deal::getProduct).filter(p -> p != null && !p.isBlank()).forEach(products::add);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("stages", stages);
        body.put("lostReasons", Catalog.DEAL_LOST_REASONS);
        body.put("products", new ArrayList<>(products));
        body.put("priorities", Catalog.PRIORITIES);
        return body;
    }

    public Map<String, Object> list(Filter filter) {
        List<Deal> all = deals.findByWorkspaceId(scope.workspaceId());
        decorate(all);
        String query = lower(filter.q());
        Predicate<Deal> common = deal -> (query.isEmpty()
                        || lower(deal.getName()).contains(query)
                        || lower(deal.getAccountName()).contains(query)
                        || lower(deal.getPrimaryContactName()).contains(query)
                        || lower(deal.getProduct()).contains(query))
                && matches(filter.owner(), deal.getOwnerId())
                && matches(filter.account(), deal.getAccountId())
                && matches(filter.stage(), deal.getStage())
                && matches(filter.product(), deal.getProduct())
                && matches(filter.priority(), deal.getPriority())
                && (filter.minValue() == null || deal.getValue() >= filter.minValue())
                && (filter.maxValue() == null || deal.getValue() <= filter.maxValue());
        List<Deal> active = all.stream()
                .filter(common)
                .filter(deal -> "Open".equals(deal.getStatus()))
                .filter(deal -> within(deal.getExpectedCloseDate(), filter.closeFrom(), filter.closeTo()))
                .sorted(Comparator.comparing(Deal::getExpectedCloseDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        List<Deal> closed = all.stream()
                .filter(common)
                .filter(deal -> !"Open".equals(deal.getStatus()))
                .filter(deal -> within(closedDate(deal), filter.closedFrom(), filter.closedTo()))
                .sorted(Comparator.comparing(this::closedDate, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        List<Map<String, Object>> stageTotals = Catalog.DEAL_STAGES.stream().map(stage -> {
            List<Deal> rows = (Catalog.DEAL_ACTIVE_STAGES.contains(stage) ? active : closed).stream()
                    .filter(deal -> stage.equals(deal.getStage())).toList();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", stage);
            row.put("count", rows.size());
            row.put("value", rows.stream().mapToLong(Deal::getValue).sum());
            row.put("weighted", rows.stream().mapToLong(Deal::getWeightedValue).sum());
            return row;
        }).toList();

        List<Deal> won = closed.stream().filter(deal -> Catalog.DEAL_WON.equals(deal.getStatus())).toList();
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalPipeline", active.stream().mapToLong(Deal::getValue).sum());
        summary.put("openDeals", active.size());
        summary.put("wonRevenue", won.stream().mapToLong(Deal::getValue).sum());
        summary.put("wonDeals", won.size());
        summary.put("weightedForecast", active.stream().mapToLong(Deal::getWeightedValue).sum());
        summary.put("totalDeals", all.size());

        List<Deal> visible = new ArrayList<>(active);
        visible.addAll(closed);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("deals", visible);
        body.put("stages", stageTotals);
        body.put("summary", summary);
        return body;
    }

    public Map<String, Object> detail(String id) {
        Deal deal = owned(id);
        decorate(List.of(deal));
        String workspace = scope.workspaceId();
        List<FollowUp> dealTasks = tasks.findByWorkspaceIdAndDealId(workspace, id).stream()
                .sorted(Comparator.comparing(FollowUpService::dueInstant, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        List<Activity> timeline = activities.forDeal(id);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("deal", deal);
        body.put("account", deal.getAccountId() == null ? null : accounts.findById(deal.getAccountId()).orElse(null));
        body.put("contact", deal.getPrimaryContactId() == null ? null : contacts.findById(deal.getPrimaryContactId()).orElse(null));
        body.put("accountContacts", deal.getAccountId() == null ? List.of()
                : contacts.findByWorkspaceIdAndAccountId(workspace, deal.getAccountId()));
        body.put("openActivities", dealTasks.stream().filter(t -> !"Completed".equals(t.getStatus())).toList());
        body.put("closedActivities", dealTasks.stream().filter(t -> "Completed".equals(t.getStatus())).toList());
        body.put("calls", timeline.stream().filter(a -> "call".equals(a.getType())).toList());
        body.put("emails", timeline.stream().filter(a -> "email".equals(a.getType())).toList());
        body.put("notes", notes.findByWorkspaceIdAndLinkedId(workspace, id).stream()
                .sorted(Comparator.comparing(com.saarthix.crm.model.Note::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList());
        body.put("attachments", attachmentRepo.findByDealIdOrderByCreatedAtDesc(id));
        body.put("timeline", timeline);
        return body;
    }

    /** Called only from lead conversion; there is deliberately no "create deal" button on the pipeline. */
    public Deal createFromLead(Lead lead, Account account, Contact contact, NewDeal request) {
        if (request.name() == null || request.name().isBlank()) throw bad("Deal name is required");
        if (request.value() == null || request.value() < 0) throw bad("Enter the deal value in rupees");
        requireDate(request.expectedCloseDate(), "Choose the expected close date");
        String priority = request.priority() != null && Catalog.PRIORITIES.contains(request.priority()) ? request.priority()
                : lead.getPriority() != null && Catalog.PRIORITIES.contains(lead.getPriority()) ? lead.getPriority() : "Medium";
        User owner = resolveOwner(request.ownerId() == null || request.ownerId().isBlank() ? lead.getOwnerId() : request.ownerId());
        Deal deal = new Deal();
        deal.setWorkspaceId(lead.getWorkspaceId());
        deal.setName(request.name().trim());
        deal.setAccountId(account.getId());
        deal.setAccountName(account.getName());
        deal.setPrimaryContactId(contact.getId());
        deal.setPrimaryContactName(contact.getName());
        deal.setOwnerId(owner.getId());
        deal.setLeadId(lead.getId());
        deal.setProduct(request.product() == null ? "" : request.product().trim());
        deal.setValue(request.value());
        deal.setStage(Catalog.DEAL_ACTIVE_STAGES.get(0));
        deal.setProbability(Catalog.DEAL_PROBABILITY.get(deal.getStage()));
        deal.setStatus("Open");
        deal.setPriority(priority);
        deal.setExpectedCloseDate(request.expectedCloseDate());
        deal.setCreatedBy(scope.id());
        deal.setCreatedByName(scope.user().getName());
        deal.setCreatedAt(Instant.now());
        deal.setUpdatedAt(Instant.now());
        deals.save(deal);
        activities.logDeal(deal, scope.user(), "created", "Deal created",
                "Converted from lead " + lead.getName() + " · " + inr(deal.getValue()) + " · " + deal.getStage());
        return deal;
    }

    public Deal update(String id, DealRequest request) {
        Deal deal = owned(id);
        if (request.name() == null || request.name().isBlank()) throw bad("Deal name is required");
        if (request.value() == null || request.value() < 0) throw bad("Enter the deal value in rupees");
        if ("Open".equals(deal.getStatus())) requireDate(request.expectedCloseDate(), "Choose the expected close date");
        Catalog.require(request.priority(), Catalog.PRIORITIES, "Priority");
        if (request.probability() != null && (request.probability() < 0 || request.probability() > 100)) {
            throw bad("Probability must be between 0 and 100");
        }
        User owner = resolveOwner(request.ownerId());
        Contact contact = null;
        if (request.primaryContactId() != null && !request.primaryContactId().isBlank()) {
            contact = contacts.findById(request.primaryContactId())
                    .filter(c -> scope.sameWorkspace(c.getWorkspaceId()))
                    .filter(c -> Objects.equals(c.getAccountId(), deal.getAccountId()))
                    .orElseThrow(() -> bad("Pick a contact from " + deal.getAccountName()));
        }
        Map<String, String> before = snapshot(deal);
        deal.setName(request.name().trim());
        deal.setProduct(request.product() == null ? "" : request.product().trim());
        deal.setValue(request.value());
        deal.setExpectedCloseDate(request.expectedCloseDate());
        deal.setPriority(request.priority());
        deal.setOwnerId(owner.getId());
        if (request.probability() != null && "Open".equals(deal.getStatus())) deal.setProbability(request.probability());
        if (contact != null) {
            deal.setPrimaryContactId(contact.getId());
            deal.setPrimaryContactName(contact.getName());
        }
        deal.setUpdatedAt(Instant.now());
        deals.save(deal);
        Map<String, String> after = snapshot(deal);
        before.forEach((label, old) -> {
            String now = after.get(label);
            if (!Objects.equals(old, now)) {
                activities.logDeal(deal, scope.user(), "field", label + " was updated", blankDash(old) + " → " + blankDash(now));
            }
        });
        return get(deal.getId());
    }

    public Deal move(String id, StageRequest request) {
        Catalog.require(request.stage(), Catalog.DEAL_STAGES, "Deal stage");
        Deal deal = owned(id);
        String previous = deal.getStage();
        String stage = request.stage();
        if (stage.equals(previous)) return get(id);
        Instant now = Instant.now();

        if (Catalog.DEAL_WON.equals(stage)) {
            requireDate(request.wonDate(), "Confirm the date this deal was won");
            if (request.finalValue() != null && request.finalValue() < 0) throw bad("Final value can't be negative");
            long oldValue = deal.getValue();
            if (request.finalValue() != null) deal.setValue(request.finalValue());
            deal.setWonDate(request.wonDate());
            deal.setClosedDate(request.wonDate());
            deal.setLostReason(null);
            deal.setLostReasonOther(null);
            apply(deal, stage, now);
            deals.save(deal);
            String change = oldValue != deal.getValue() ? " (was " + inr(oldValue) + ")" : "";
            activities.logDeal(deal, scope.user(), "won", "Deal won",
                    inr(deal.getValue()) + change + " · won on " + deal.getWonDate() + " · " + previous + " → " + stage);
            return get(id);
        }

        if (Catalog.DEAL_LOST.equals(stage)) {
            if (request.lostReason() == null || request.lostReason().isBlank()) throw bad("Pick a reason for losing this deal");
            Catalog.require(request.lostReason(), Catalog.DEAL_LOST_REASONS, "Lost reason");
            boolean other = "Other".equals(request.lostReason());
            if (other && (request.lostReasonOther() == null || request.lostReasonOther().isBlank())) {
                throw bad("Describe why this deal was lost");
            }
            deal.setLostReason(request.lostReason());
            deal.setLostReasonOther(other ? request.lostReasonOther().trim() : null);
            deal.setWonDate(null);
            deal.setClosedDate(isDate(request.closedDate()) ? request.closedDate() : LocalDate.now().toString());
            apply(deal, stage, now);
            deals.save(deal);
            activities.logDeal(deal, scope.user(), "lost", "Deal lost",
                    previous + " → " + stage + " · " + (other ? deal.getLostReasonOther() : deal.getLostReason()));
            return get(id);
        }

        deal.setWonDate(null);
        deal.setClosedDate(null);
        deal.setLostReason(null);
        deal.setLostReasonOther(null);
        apply(deal, stage, now);
        deals.save(deal);
        activities.logDeal(deal, scope.user(), "stage", "Deal stage changed", previous + " → " + stage);
        return get(id);
    }

    public Deal get(String id) {
        Deal deal = owned(id);
        decorate(List.of(deal));
        return deal;
    }

    public Attachment upload(String id, AttachmentService.AttachmentRequest request) {
        Deal deal = owned(id);
        Attachment file = attachments.store(deal.getWorkspaceId(), null, deal.getId(), request);
        activities.logDeal(deal, scope.user(), "attachment", "Document added", file.getFileName());
        return file;
    }

    public Map<String, Object> download(String id, String attachmentId) {
        owned(id);
        return attachments.download(attachments.find(attachmentId, file -> id.equals(file.getDealId())));
    }

    public void deleteAttachment(String id, String attachmentId) {
        owned(id);
        attachments.delete(attachments.find(attachmentId, file -> id.equals(file.getDealId())));
    }

    public Deal owned(String id) {
        return deals.findById(id)
                .filter(deal -> scope.sameWorkspace(deal.getWorkspaceId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Deal not found"));
    }

    /** Fills owner name, weighted value and the next open follow-up. */
    public void decorate(List<Deal> rows) {
        if (rows.isEmpty()) return;
        Map<String, String> names = new HashMap<>();
        users.findAll().forEach(user -> names.put(user.getId(), user.getName()));
        Map<String, FollowUp> next = tasks.findByWorkspaceIdAndDealIdNotNullAndStatusNot(scope.workspaceId(), "Completed").stream()
                .filter(task -> FollowUpService.dueInstant(task) != null)
                .collect(Collectors.toMap(FollowUp::getDealId, task -> task,
                        (a, b) -> FollowUpService.dueInstant(a).isAfter(FollowUpService.dueInstant(b)) ? b : a));
        rows.forEach(deal -> {
            deal.setOwnerName(names.getOrDefault(deal.getOwnerId(), "Unassigned"));
            deal.setWeightedValue(Math.round(deal.getValue() * deal.getProbability() / 100.0));
            FollowUp task = next.get(deal.getId());
            if (task == null) {
                deal.setNextAction(null);
            } else {
                Map<String, Object> action = new LinkedHashMap<>();
                action.put("id", task.getId());
                action.put("type", task.getType() == null ? "Follow-up" : task.getType());
                action.put("title", task.getTitle());
                action.put("dueDate", task.getDueDate());
                action.put("dueTime", task.getDueTime());
                action.put("dueAt", task.getDueAt());
                deal.setNextAction(action);
            }
        });
    }

    public static String inr(long value) {
        String digits = Long.toString(Math.abs(value));
        if (digits.length() > 3) {
            String last = digits.substring(digits.length() - 3);
            String rest = digits.substring(0, digits.length() - 3).replaceAll("\\B(?=(\\d{2})+(?!\\d))", ",");
            digits = rest + "," + last;
        }
        return (value < 0 ? "-₹" : "₹") + digits;
    }

    private void apply(Deal deal, String stage, Instant now) {
        deal.setStage(stage);
        deal.setStatus(Catalog.dealStatus(stage));
        deal.setProbability(Catalog.DEAL_PROBABILITY.getOrDefault(stage, 0));
        deal.setClosedAt("Open".equals(deal.getStatus()) ? null : now);
        deal.setUpdatedAt(now);
    }

    private String closedDate(Deal deal) {
        return deal.getClosedDate();
    }

    private Map<String, String> snapshot(Deal deal) {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("Deal Name", deal.getName());
        values.put("Product", deal.getProduct());
        values.put("Deal Value", inr(deal.getValue()));
        values.put("Expected Close Date", deal.getExpectedCloseDate());
        values.put("Priority", deal.getPriority());
        values.put("Deal Owner", users.findById(deal.getOwnerId()).map(User::getName).orElse(""));
        values.put("Probability", deal.getProbability() + "%");
        values.put("Primary Contact", deal.getPrimaryContactName());
        return values;
    }

    private User resolveOwner(String ownerId) {
        if (ownerId == null || ownerId.isBlank()) return scope.user();
        return users.findById(ownerId)
                .filter(user -> scope.workspaceId().equals(user.getWorkspaceId()))
                .orElseThrow(() -> bad("That teammate is not in this workspace"));
    }

    private static boolean within(String day, String from, String to) {
        boolean bounded = (from != null && !from.isBlank()) || (to != null && !to.isBlank());
        if (!bounded) return true;
        if (day == null || day.isBlank()) return false;
        return (from == null || from.isBlank() || day.compareTo(from) >= 0)
                && (to == null || to.isBlank() || day.compareTo(to) <= 0);
    }

    private static boolean matches(String wanted, String actual) {
        return wanted == null || wanted.isBlank() || "All".equalsIgnoreCase(wanted) || wanted.equals(actual);
    }

    private static void requireDate(String value, String message) {
        if (!isDate(value)) throw bad(message);
    }

    private static boolean isDate(String value) {
        if (value == null || value.isBlank()) return false;
        try {
            LocalDate.parse(value);
            return true;
        } catch (Exception ex) {
            return false;
        }
    }

    private static String lower(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static String blankDash(String value) {
        return value == null || value.isBlank() ? "—" : value;
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    public record Filter(String q, String owner, String account, String stage, String product, String priority,
                         String closeFrom, String closeTo, Long minValue, Long maxValue,
                         String closedFrom, String closedTo) {
    }

    public record NewDeal(String name, String product, Long value, String expectedCloseDate, String priority, String ownerId) {
    }

    public record DealRequest(String name, String product, Long value, String expectedCloseDate, String priority,
                              String ownerId, String primaryContactId, Integer probability) {
    }

    public record StageRequest(String stage, String wonDate, Long finalValue, String lostReason, String lostReasonOther,
                               String closedDate) {
    }
}
