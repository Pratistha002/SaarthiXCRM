package com.saarthix.crm.service;

import com.saarthix.crm.domain.Catalog;
import com.saarthix.crm.model.Contact;
import com.saarthix.crm.model.FollowUp;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.repo.ContactRepository;
import com.saarthix.crm.repo.FollowUpRepository;
import com.saarthix.crm.repo.LeadRepository;
import com.saarthix.crm.security.Scope;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.TextStyle;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

@Service
public class DashboardService {
    private final LeadRepository leads;
    private final ContactRepository contacts;
    private final FollowUpRepository tasks;
    private final ActivityService activities;
    private final Scope scope;

    public DashboardService(LeadRepository leads, ContactRepository contacts, FollowUpRepository tasks,
                            ActivityService activities, Scope scope) {
        this.leads = leads;
        this.contacts = contacts;
        this.tasks = tasks;
        this.activities = activities;
        this.scope = scope;
    }

    public Map<String, Object> snapshot() {
        String workspaceId = scope.workspaceId();
        List<Lead> all = new ArrayList<>(leads.findByWorkspaceId(workspaceId));
        List<Contact> people = contacts.findByWorkspaceId(workspaceId);
        List<FollowUp> followUps = tasks.findByWorkspaceId(workspaceId);
        LocalDate today = LocalDate.now();

        long pipelineValue = all.stream().mapToLong(Lead::getValue).sum();
        long wonValue = all.stream().filter(l -> "Won".equals(l.getStage())).mapToLong(Lead::getValue).sum();
        long forecast = all.stream().mapToLong(l -> Catalog.weighted(l.getValue(), l.getStage())).sum();
        long wonCount = all.stream().filter(l -> "Won".equals(l.getStage())).count();
        long lostCount = all.stream().filter(l -> "Lost".equals(l.getStage())).count();
        long decided = wonCount + lostCount;
        double conversion = decided == 0 ? 0 : (wonCount * 100.0 / decided);

        Instant weekAgo = Instant.now().minus(7, ChronoUnit.DAYS);
        Instant twoWeeks = Instant.now().minus(14, ChronoUnit.DAYS);
        long weekly = wonBetween(all, weekAgo, Instant.now().plus(1, ChronoUnit.DAYS));
        long previousWeekly = wonBetween(all, twoWeeks, weekAgo);
        double weeklyChange = previousWeekly == 0 ? (weekly > 0 ? 100 : 0) : ((weekly - previousWeekly) * 100.0 / previousWeekly);

        Instant monthAgo = Instant.now().minus(30, ChronoUnit.DAYS);
        Instant twoMonths = Instant.now().minus(60, ChronoUnit.DAYS);
        double conversionChange = rate(all, monthAgo, Instant.now()) - rate(all, twoMonths, monthAgo);

        List<Map<String, Object>> engagement = engagement(all);
        List<Lead> recentLeads = all.stream()
                .sorted(Comparator.comparing(Lead::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(6)
                .toList();

        List<Map<String, Object>> sources = new ArrayList<>();
        for (String source : Catalog.SOURCES) {
            sources.add(Map.of("name", source, "count", all.stream().filter(l -> source.equals(l.getSource())).count()));
        }

        List<FollowUp> upcoming = followUps.stream()
                .filter(t -> !"Completed".equals(t.getStatus()))
                .sorted(Comparator.comparing(FollowUp::getDueDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .limit(4)
                .toList();

        List<Map<String, Object>> stages = new ArrayList<>();
        for (String stage : Catalog.STAGES) {
            List<Lead> rows = all.stream().filter(l -> stage.equals(l.getStage())).toList();
            long value = rows.stream().mapToLong(Lead::getValue).sum();
            int pct = pipelineValue == 0 ? 0 : (int) Math.round(value * 100.0 / pipelineValue);
            stages.add(Map.of(
                    "stage", stage,
                    "count", rows.size(),
                    "value", value,
                    "weighted", rows.stream().mapToLong(l -> Catalog.weighted(l.getValue(), l.getStage())).sum(),
                    "weight", Catalog.weight(stage),
                    "pct", pct));
        }

        Map<String, Long> wonReasons = new LinkedHashMap<>();
        Map<String, Long> lostReasons = new LinkedHashMap<>();
        Catalog.WON_REASONS.forEach(reason -> wonReasons.put(reason,
                all.stream().filter(l -> "Won".equals(l.getStage()) && reason.equals(l.getCloseReason())).count()));
        Catalog.LOST_REASONS.forEach(reason -> lostReasons.put(reason,
                all.stream().filter(l -> "Lost".equals(l.getStage()) && reason.equals(l.getCloseReason())).count()));

        LocalDate start = LocalDate.of(today.getYear(), 1, 1);
        String range = start.getDayOfMonth() + " " + start.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH)
                + " – " + today.getDayOfMonth() + " " + today.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH)
                + ", " + today.getYear();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("rangeLabel", range);
        body.put("pipelineValue", pipelineValue);
        body.put("forecast", forecast);
        body.put("leadCount", all.size());
        body.put("weeklyRevenue", weekly);
        body.put("weeklyChangePct", round1(weeklyChange));
        body.put("totalWon", wonValue);
        body.put("conversionPct", round1(conversion));
        body.put("conversionChangePct", round1(conversionChange));
        body.put("openTasks", followUps.stream().filter(t -> !"Completed".equals(t.getStatus())).count());
        body.put("engagement", engagement);
        body.put("annual", annual(all));
        body.put("highlight", highlight(engagement));
        body.put("revenueSeries", revenueSeries(all));
        body.put("activity", recentLeads);
        body.put("timeline", activities.recent(workspaceId));
        body.put("sources", sources);
        body.put("upcoming", upcoming);
        body.put("stages", stages);
        body.put("wonReasons", wonReasons);
        body.put("lostReasons", lostReasons);
        body.put("topContacts", people.stream()
                .sorted(Comparator.comparing(Contact::isFavorite).reversed()
                        .thenComparing(Contact::getName, String.CASE_INSENSITIVE_ORDER))
                .limit(5).toList());
        body.put("topDeals", all.stream()
                .filter(l -> Catalog.isOpen(l.getStage()))
                .sorted(Comparator.comparingLong(Lead::getValue).reversed())
                .limit(5).toList());
        body.put("openDeals", all.stream().filter(l -> Catalog.isOpen(l.getStage())).count());
        return body;
    }

    private List<Map<String, Object>> engagement(List<Lead> all) {
        List<YearMonth> months = all.stream()
                .map(Lead::getCreatedAt)
                .filter(i -> i != null)
                .map(i -> YearMonth.from(i.atZone(ZoneOffset.UTC)))
                .distinct()
                .sorted()
                .toList();
        if (months.isEmpty()) {
            YearMonth now = YearMonth.now();
            months = new ArrayList<>();
            for (int i = 5; i >= 0; i--) months.add(now.minusMonths(i));
        }
        YearMonth start = months.get(0);
        YearMonth end = months.get(months.size() - 1);
        List<YearMonth> span = new ArrayList<>();
        for (YearMonth cursor = start; !cursor.isAfter(end); cursor = cursor.plusMonths(1)) {
            span.add(cursor);
        }
        if (span.size() > 6) span = span.subList(span.size() - 6, span.size());
        List<Map<String, Object>> rows = new ArrayList<>();
        for (YearMonth month : span) {
            long count = all.stream().filter(l -> l.getCreatedAt() != null
                    && YearMonth.from(l.getCreatedAt().atZone(ZoneOffset.UTC)).equals(month)).count();
            rows.add(Map.of("month", month.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH), "count", count));
        }
        return rows;
    }

    private List<Map<String, Object>> annual(List<Lead> all) {
        Map<Integer, Long> counts = new TreeMap<>();
        for (Lead lead : all) {
            if (lead.getCreatedAt() == null) continue;
            counts.merge(lead.getCreatedAt().atZone(ZoneOffset.UTC).getYear(), 1L, Long::sum);
        }
        if (counts.isEmpty()) counts.put(LocalDate.now().getYear(), 0L);
        List<Map<String, Object>> rows = new ArrayList<>();
        counts.forEach((year, count) -> rows.add(Map.of("month", String.valueOf(year), "count", count)));
        return rows;
    }

    private Map<String, Object> highlight(List<Map<String, Object>> engagement) {
        if (engagement.isEmpty()) return Map.of("index", 0, "changePct", 0);
        int best = 0;
        long bestCount = -1;
        for (int i = 0; i < engagement.size(); i++) {
            long count = ((Number) engagement.get(i).get("count")).longValue();
            if (count > bestCount) {
                bestCount = count;
                best = i;
            }
        }
        long prev = best == 0 ? 0 : ((Number) engagement.get(best - 1).get("count")).longValue();
        double change = prev == 0 ? (bestCount > 0 ? 100 : 0) : ((bestCount - prev) * 100.0 / prev);
        return Map.of("index", best, "changePct", round1(change));
    }

    private List<Map<String, Object>> revenueSeries(List<Lead> all) {
        YearMonth end = YearMonth.now();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (int i = 5; i >= 0; i--) {
            YearMonth month = end.minusMonths(i);
            long value = all.stream()
                    .filter(l -> "Won".equals(l.getStage()) && l.getClosedAt() != null)
                    .filter(l -> YearMonth.from(l.getClosedAt().atZone(ZoneOffset.UTC)).equals(month))
                    .mapToLong(Lead::getValue)
                    .sum();
            rows.add(Map.of("month", month.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH), "value", value));
        }
        return rows;
    }

    private long wonBetween(List<Lead> all, Instant from, Instant to) {
        return all.stream()
                .filter(l -> "Won".equals(l.getStage()) && l.getClosedAt() != null)
                .filter(l -> !l.getClosedAt().isBefore(from) && l.getClosedAt().isBefore(to))
                .mapToLong(Lead::getValue)
                .sum();
    }

    private double rate(List<Lead> all, Instant from, Instant to) {
        long won = all.stream().filter(l -> "Won".equals(l.getStage()) && inWindow(l.getClosedAt(), from, to)).count();
        long lost = all.stream().filter(l -> "Lost".equals(l.getStage()) && inWindow(l.getClosedAt(), from, to)).count();
        long decided = won + lost;
        return decided == 0 ? 0 : won * 100.0 / decided;
    }

    private boolean inWindow(Instant instant, Instant from, Instant to) {
        return instant != null && !instant.isBefore(from) && instant.isBefore(to);
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
