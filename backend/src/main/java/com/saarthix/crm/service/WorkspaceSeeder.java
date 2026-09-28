package com.saarthix.crm.service;

import com.saarthix.crm.model.Contact;
import com.saarthix.crm.model.FollowUp;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.model.Note;
import com.saarthix.crm.model.User;
import com.saarthix.crm.model.Workspace;
import com.saarthix.crm.repo.ContactRepository;
import com.saarthix.crm.repo.FollowUpRepository;
import com.saarthix.crm.repo.LeadRepository;
import com.saarthix.crm.repo.NoteRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class WorkspaceSeeder {
    private final LeadRepository leads;
    private final ContactRepository contacts;
    private final NoteRepository notes;
    private final FollowUpRepository tasks;
    private final ActivityService activities;
    private final NotificationService notifications;

    public WorkspaceSeeder(LeadRepository leads, ContactRepository contacts, NoteRepository notes,
                           FollowUpRepository tasks, ActivityService activities, NotificationService notifications) {
        this.leads = leads;
        this.contacts = contacts;
        this.notes = notes;
        this.tasks = tasks;
        this.activities = activities;
        this.notifications = notifications;
    }

    public int seedIfEmpty(User owner) {
        if (owner.getWorkspaceId() == null) return 0;
        Workspace workspace = new Workspace();
        workspace.setId(owner.getWorkspaceId());
        return seedIfEmpty(workspace, List.of(owner));
    }

    public int seedIfEmpty(Workspace workspace, List<User> members) {
        if (workspace == null || workspace.getId() == null || members == null || members.isEmpty()) return 0;
        if (leads.countByWorkspaceId(workspace.getId()) > 0) return 0;
        if (members.stream().anyMatch(user -> leads.countByOwnerId(user.getId()) > 0)) return 0;
        User owner = members.get(0);
        List<Lead> saved = seedLeads(workspace, members);
        seedContacts(workspace, owner);
        seedNotes(workspace, members, saved);
        seedTasks(workspace, members, saved);
        seedNotifications(workspace, members);
        return saved.size();
    }

    private User pick(List<User> members, int index) {
        return members.get(index % members.size());
    }

    private List<Lead> seedLeads(Workspace workspace, List<User> members) {
        record Row(String name, String company, long value, String stage, String priority, String source, String notes) {}
        List<Row> rows = List.of(
                new Row("Lucas Carter", "Massive Dynamic", 143000, "New", "High", "Cold Outreach", "Referred by an existing customer."),
                new Row("Evelyn Diaz", "Aperture Labs", 215000, "New", "High", "Cold Outreach", "Asked for a security overview before a broader pilot."),
                new Row("Felix Khan", "Dunder Mifflin", 197000, "New", "Medium", "Social", "Met at a founder dinner. Wants pricing before involving finance."),
                new Row("Jordan Black", "Northwind Trading", 150000, "New", "High", "Website", "Inbound demo request from the pricing page."),
                new Row("Ruby Bennett", "Wayne Tech", 118000, "New", "High", "Event", "Booth conversation. Interested in pipeline visibility for a 12-person team."),
                new Row("Julian Webb", "Wonka Industries", 52000, "New", "Medium", "Website", "Downloaded the overview and asked for a follow-up next week."),
                new Row("Ruby Murphy", "Black Mesa", 27000, "New", "Medium", "Event", "Early-stage interest. Needs an internal sponsor."),
                new Row("Abigail Diaz", "Wayne Enterprises", 54000, "New", "Medium", "Referral", "Champion is pushing internally. Legal review is the blocker."),
                new Row("Sam Rivera", "Hooli", 59000, "New", "Low", "Cold Outreach", "Opened two emails. No reply yet."),
                new Row("Nina Cho", "Pied Piper", 61000, "New", "Medium", "Social", "Commented on a product post and asked about pipeline visibility."),
                new Row("Omar Singh", "Soylent", 61000, "New", "High", "Cold Outreach", "Replied that Q4 budget is still being shaped."),
                new Row("Priya Nair", "Initech", 61000, "New", "Medium", "Event", "Wants a technical session with the operations lead."),
                new Row("Noah Khan", "Nakatomi", 144000, "Qualified", "Low", "Social", "Wants SSO and SCIM before they will commit."),
                new Row("Lucas Brooks", "Cogswell Cogs", 171000, "Qualified", "Medium", "Referral", "Technical deep-dive requested with their solutions team."),
                new Row("Zoe Diaz", "Globex", 180000, "Qualified", "High", "Website", "Qualified on budget. Waiting on a stakeholder map."),
                new Row("Felix Patel", "Hanso Foundation", 28000, "Qualified", "Low", "Other", "Small team, long evaluation cycle."),
                new Row("Aria Ramos", "Soylent Green", 94000, "Qualified", "High", "Cold Outreach", "Confirmed the problem and the buying group."),
                new Row("Elena Voss", "Wayne Tech", 140000, "Qualified", "Medium", "Event", "Asked for references in manufacturing."),
                new Row("Chris Dalton", "Duff Brewing", 122000, "Qualified", "Low", "Social", "Warm intro from an existing customer."),
                new Row("Chloe Park", "Soylent", 216000, "Proposal", "High", "Website", "Renewal conversation. Likely to expand seats next quarter."),
                new Row("Owen Mitchell", "Pied Piper", 106000, "Proposal", "High", "Other", "Proposal sent. Procurement is comparing two vendors."),
                new Row("Ella Brooks", "Stark Industries", 52000, "Proposal", "Medium", "Event", "Waiting on legal redlines."),
                new Row("Mia Bennett", "Vandelay Industries", 12000, "Proposal", "High", "Social", "Small deal, fast cycle if pricing is approved."),
                new Row("Liam Ortiz", "Nakatomi", 60000, "Proposal", "Medium", "Cold Outreach", "Asked for a one-page scope before Friday."),
                new Row("Sofia Reed", "Gringotts", 58000, "Proposal", "High", "Referral", "Security questionnaire is the remaining gate."),
                new Row("Noah Blake", "Wonka Industries", 56000, "Proposal", "Low", "Website", "Proposal opened twice. No questions yet."),
                new Row("Ava Park", "Pendant Publishing", 55000, "Proposal", "Medium", "Other", "Comparing on price. Support SLA matters more than features."),
                new Row("Wyatt Greer", "Gekko & Co", 159000, "Won", "High", "Event", "Closed after a quarterly check-in with the solutions team."),
                new Row("Olivia Cole", "Spacely Sprockets", 26000, "Won", "High", "Social", "Fast close. Asked for onboarding this month."),
                new Row("Mia Hale", "Stark Labs", 145000, "Won", "Medium", "Website", "Procurement confirmed budget and signed."),
                new Row("Henry Foster", "Cyberdyne", 140000, "Won", "High", "Referral", "Won on security review and a fixed onboarding plan."),
                new Row("Harper Frost", "Tyrell Corp", 120000, "Won", "Medium", "Cold Outreach", "Requested SOC 2, then approved the rollout."),
                new Row("Jackson Bauer", "Initech", 120000, "Won", "Low", "Event", "Closed after the security document pack."),
                new Row("Chloe Mitchell", "Bluth Company", 154000, "Lost", "Medium", "Event", "Went quiet after the second meeting."),
                new Row("Amelia Khan", "Umbrella Co", 148000, "Lost", "Medium", "Referral", "Lost on price against an incumbent."),
                new Row("Derek Cho", "Hooli", 98000, "Lost", "High", "Cold Outreach", "Champion left the company."),
                new Row("Lila Shah", "Globex", 86000, "Lost", "Low", "Social", "No executive sponsor."),
                new Row("Ben Carter", "Wayne Enterprises", 82000, "Lost", "Medium", "Website", "Project paused until next fiscal year."),
                new Row("Nora Kim", "Duff Brewing", 72000, "Lost", "High", "Event", "Chose to stay with spreadsheets for now."),
                new Row("Owen Blake", "Nakatomi", 60000, "Lost", "Low", "Other", "Timing was wrong. Asked to reconnect in two quarters.")
        );
        int[] months = {
                1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3,
                4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5,
                6, 6, 6, 6, 6, 6, 6, 6
        };
        Map<String, Integer> recent = Map.of(
                "Lucas Carter", 1,
                "Olivia Cole", 2,
                "Noah Khan", 3,
                "Ruby Bennett", 4,
                "Julian Webb", 5,
                "Chloe Mitchell", 6
        );
        int won = 0;
        List<Lead> saved = new java.util.ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            Row row = rows.get(i);
            User owner = pick(members, i);
            Lead lead = new Lead();
            lead.setWorkspaceId(workspace.getId());
            lead.setOwnerId(owner.getId());
            lead.setOwnerName(owner.getName());
            lead.setName(row.name());
            lead.setCompany(row.company());
            lead.setEmail(emailFor(row.name(), row.company()));
            lead.setPhone("Lucas Carter".equals(row.name()) ? "+1 555 0699" : String.format("+1 555 %04d", 1100 + i));
            lead.setValue(row.value());
            lead.setStage(row.stage());
            lead.setPriority(row.priority());
            lead.setSource(row.source());
            lead.setNotes(row.notes());
            int day = 4 + (i % 18);
            lead.setCreatedAt(LocalDate.of(2026, months[i], day).atTime(9, 15).toInstant(ZoneOffset.UTC));
            if (recent.containsKey(row.name())) {
                lead.setUpdatedAt(Instant.now().minus(recent.get(row.name()), ChronoUnit.HOURS));
            } else {
                lead.setUpdatedAt(Instant.now().minus(2 + (i % 12), ChronoUnit.DAYS));
            }
            if ("Won".equals(row.stage())) {
                lead.setClosedAt(wonClosed(won++));
                lead.setCloseReason(List.of("Product fit", "Relationship", "Speed", "Referral", "Price", "Other").get(i % 6));
                lead.setCloseNote(row.notes());
            } else if ("Lost".equals(row.stage())) {
                lead.setClosedAt(Instant.now().minus(20L + i, ChronoUnit.DAYS));
                lead.setCloseReason(List.of("Price", "Competitor", "Timing", "No sponsor", "No budget", "Other").get(i % 6));
                lead.setCloseNote(row.notes());
            }
            leads.save(lead);
            activities.logAt(lead, owner.getName(), "created", "Lead added", row.notes(), lead.getCreatedAt());
            if ("Won".equals(row.stage()) || "Lost".equals(row.stage())) {
                activities.logAt(lead, owner.getName(), "stage", "Moved to " + row.stage(),
                        "New → " + row.stage() + " · " + lead.getCloseReason(), lead.getClosedAt());
            }
            saved.add(lead);
        }
        return saved;
    }

    private Instant wonClosed(int index) {
        return switch (index) {
            case 0 -> Instant.now().minus(2, ChronoUnit.DAYS);
            case 1 -> Instant.now().minus(5, ChronoUnit.DAYS);
            case 2 -> Instant.now().minus(10, ChronoUnit.DAYS);
            case 3 -> LocalDate.of(2026, 4, 18).atTime(15, 0).toInstant(ZoneOffset.UTC);
            case 4 -> LocalDate.of(2026, 2, 12).atTime(15, 0).toInstant(ZoneOffset.UTC);
            default -> LocalDate.of(2026, 3, 20).atTime(15, 0).toInstant(ZoneOffset.UTC);
        };
    }

    private void seedContacts(Workspace workspace, User owner) {
        record C(String name, String title, String company, String email, String phone, boolean favorite, List<String> tags) {}
        List<C> rows = List.of(
                new C("Abigail Mitchell", "Account Executive", "Bluth Company", "abigail@bluth.com", "+1 555 0769", true, List.of("finance", "technical", "warm")),
                new C("Adrian Bishop", "CEO", "Gringotts", "adrian@gringotts.bank", "+1 555 0310", true, List.of("decision-maker")),
                new C("Aiden Brooks", "Product Lead", "Monsters Inc", "aiden@monsters.co", "+1 555 0520", true, List.of("vip")),
                new C("Adrian Park", "CEO", "Stark Industries", "adrian@stark.io", "+1 555 0577", false, List.of("executive", "finance")),
                new C("Amelia Kim", "VP of Sales", "Duff Brewing", "amelia@duff.com", "+1 555 0932", false, List.of("vip")),
                new C("Amelia Patel", "COO", "Wayne Tech", "amelia@waynetech.io", "+1 555 0535", false, List.of("decision-maker", "champion")),
                new C("Aria Cole", "Head of Growth", "Nakatomi", "aria@nakatomi.co", "+1 555 0441", false, List.of("saas", "finance")),
                new C("Aria Silva", "Solutions Architect", "Kruger Industrial", "aria@kruger.io", "+1 555 0618", false, List.of("finance", "technical")),
                new C("Chloe Bennett", "CTO", "Wonka Industries", "chloe@wonka.co", "+1 555 0288", false, List.of("decision-maker")),
                new C("Elena Voss", "VP Operations", "Wayne Tech", "elena@waynetech.io", "+1 555 0174", false, List.of("enterprise", "technical")),
                new C("Henry Foster", "Director of IT", "Cyberdyne", "henry@cyberdyne.io", "+1 555 0190", false, List.of("technical", "influencer")),
                new C("Mia Hale", "Procurement Lead", "Stark Labs", "mia@starklabs.com", "+1 555 0333", false, List.of("finance")),
                new C("Noah Khan", "Head of Security", "Nakatomi", "noah@nakatomi.co", "+1 555 0412", false, List.of("technical", "enterprise")),
                new C("Olivia Cole", "Founder", "Spacely Sprockets", "olivia@spacely.co", "+1 555 0881", false, List.of("champion", "saas")),
                new C("Wyatt Greer", "VP Revenue", "Gekko & Co", "wyatt@gekko.co", "+1 555 0904", false, List.of("executive", "finance")),
                new C("Zoe Diaz", "RevOps Manager", "Globex", "zoe@globex.com", "+1 555 0226", false, List.of("influencer", "saas")),
                new C("Sofia Reed", "CISO", "Gringotts", "sofia@gringotts.bank", "+1 555 0144", false, List.of("technical", "vip")),
                new C("Liam Ortiz", "Sales Manager", "Nakatomi", "liam@nakatomi.co", "+1 555 0670", false, List.of("warm"))
        );
        for (C row : rows) {
            Contact contact = new Contact();
            contact.setWorkspaceId(workspace.getId());
            contact.setOwnerId(owner.getId());
            contact.setName(row.name());
            contact.setTitle(row.title());
            contact.setCompany(row.company());
            contact.setEmail(row.email());
            contact.setPhone(row.phone());
            contact.setFavorite(row.favorite());
            contact.setTags(row.tags());
            contact.setCreatedAt(Instant.now().minus(row.name().length(), ChronoUnit.DAYS));
            contacts.save(contact);
        }
    }

    private void seedNotes(Workspace workspace, List<User> members, List<Lead> saved) {
        record N(String body, boolean pinned, String leadName, int daysAgo) {}
        List<N> rows = List.of(
                new N("Renewal conversation with Soylent — likely to expand seats next quarter.", true, "Chloe Park", 8),
                new N("Champion at Wayne Enterprises is pushing internally; legal review is the main blocker right now.", false, "Abigail Diaz", 30),
                new N("Umbrella Co is comparing us against a competitor on price. Emphasise support SLA and onboarding.", false, "Amelia Khan", 60),
                new N("Renewal conversation with Wayne Tech — likely to expand seats next quarter.", true, "Ruby Bennett", 55),
                new N("Pendant Publishing is comparing us against a competitor on price. Emphasise support SLA and onboarding.", false, "Ava Park", 34),
                new N("Procurement at Stark Labs confirmed budget. Moving to contract redlines this week.", false, "Mia Hale", 50),
                new N("Nakatomi wants SSO and SCIM provisioning. Confirm the timeline with product before committing.", true, "Noah Khan", 80),
                new N("Tyrell Corp requested a security questionnaire and SOC 2 report. Sent to the trust center.", false, "Harper Frost", 28),
                new N("Left a voicemail for Initech. Follow up by email if there is no response within 48 hours.", false, "Jackson Bauer", 62),
                new N("Pipeline review: focus this week on proposals above $100k and every overdue security follow-up.", true, "", 3),
                new N("Referred by an existing customer. Asked for a technical deep-dive with their ops lead.", false, "Lucas Carter", 4),
                new N("Q3 target is to lift win rate by putting a next-step date on every qualified deal.", false, "", 12)
        );
        for (N row : rows) {
            User author = pick(members, row.daysAgo());
            Note note = new Note();
            note.setWorkspaceId(workspace.getId());
            note.setOwnerId(author.getId());
            note.setAuthorName(author.getName());
            note.setBody(row.body());
            note.setPinned(row.pinned());
            note.setCreatedAt(Instant.now().minus(row.daysAgo(), ChronoUnit.DAYS));
            saved.stream().filter(l -> l.getName().equals(row.leadName())).findFirst().ifPresent(lead -> {
                note.setLinkedType("lead");
                note.setLinkedId(lead.getId());
                note.setLinkedName(lead.getName());
            });
            if (note.getLinkedId() == null) {
                note.setLinkedType("");
                note.setLinkedId("");
                note.setLinkedName("");
            }
            notes.save(note);
            saved.stream().filter(l -> l.getName().equals(row.leadName())).findFirst()
                    .ifPresent(lead -> activities.logAt(lead, author.getName(), "note", "Note added", row.body(), note.getCreatedAt()));
        }
    }

    private void seedTasks(Workspace workspace, List<User> members, List<Lead> saved) {
        record T(String title, String details, String due, String priority, String status, String lead) {}
        List<T> rows = List.of(
                new T("Send security docs to Initech", "Share the trust center pack and SOC 2 summary.", "2026-05-31", "Medium", "In Progress", "Olivia Cole"),
                new T("Schedule technical deep-dive with Cogswell Cogs", "Include solutions engineering and the buyer.", "2026-06-09", "High", "In Progress", "Lucas Brooks"),
                new T("Quarterly check-in with Sterling Cooper", "Reference the latest proposal and pricing.", "2026-06-10", "Low", "In Progress", "Aria Ramos"),
                new T("Quarterly check-in with Gekko & Co", "Coordinate with the solutions engineering team.", "2026-06-13", "Low", "In Progress", "Wyatt Greer"),
                new T("Book discovery call with Soylent", "Confirm the expansion seats and the economic buyer.", "2026-05-18", "High", "In Progress", "Chloe Park"),
                new T("Send proposal recap to Pied Piper", "Restate scope, price, and the open questions.", "2026-07-02", "Medium", "Pending", "Owen Mitchell"),
                new T("Intro security review for Nakatomi", "SSO and SCIM timeline before a verbal commit.", "2026-08-15", "High", "In Progress", "Noah Khan"),
                new T("Confirm Q4 budget with Soylent", "Ask Chloe for the seat count and signature path.", "2026-09-28", "High", "Pending", "Chloe Park"),
                new T("Demo for Aperture Labs", "Walk through pipeline health and follow-ups.", "2026-10-02", "Medium", "Pending", "Evelyn Diaz"),
                new T("Renewal prep for Globex", "Pull the last three notes before the call.", "2026-10-08", "Low", "Pending", "Zoe Diaz"),
                new T("Contract redlines with Dunder Mifflin", "Finance wants a cleaner payment schedule.", "2026-10-15", "High", "In Progress", "Felix Khan"),
                new T("Kickoff with Gekko & Co", "Onboarding agenda and success metrics.", "2026-09-02", "Medium", "Completed", "Wyatt Greer"),
                new T("Pricing review with Umbrella Co", "Document why the deal was lost.", "2026-08-20", "Low", "Completed", "Amelia Khan"),
                new T("Intro email to Northwind Trading", "Sent the overview and a meeting link.", "2026-09-12", "Medium", "Completed", "Jordan Black"),
                new T("Reference call for Massive Dynamic", "Customer reference completed.", "2026-07-22", "Low", "Completed", "Lucas Carter"),
                new T("Follow up with Wayne Tech", "Send the manufacturing case study.", "2026-09-30", "Medium", "Pending", "Ruby Bennett")
        );
        for (T row : rows) {
            FollowUp task = new FollowUp();
            task.setWorkspaceId(workspace.getId());
            User assignee = pick(members, row.title().length());
            task.setOwnerId(assignee.getId());
            task.setTitle(row.title());
            task.setDetails(row.details());
            task.setDueDate(row.due());
            task.setPriority(row.priority());
            task.setStatus(row.status());
            task.setAssigneeId(assignee.getId());
            task.setAssigneeName(assignee.getName());
            saved.stream().filter(l -> l.getName().equals(row.lead())).findFirst().ifPresent(lead -> {
                task.setLeadId(lead.getId());
                task.setLeadName(lead.getName());
            });
            task.setCreatedAt(Instant.now().minus(15, ChronoUnit.DAYS));
            tasks.save(task);
        }
    }

    private void seedNotifications(Workspace workspace, List<User> members) {
        for (User member : members) {
            notifications.pushAt(member.getId(), workspace.getId(), "welcome",
                    "Welcome to SaarthiX CRM",
                    "The team pipeline is ready. Drag deals, send emails, and clear follow-ups.",
                    "/dashboard", Instant.now().minus(1, ChronoUnit.HOURS));
        }
        User first = members.get(0);
        notifications.pushAt(first.getId(), workspace.getId(), "lead",
                "Largest open deal", "Chloe Park at Soylent is the biggest active proposal.",
                "/leads", Instant.now().minus(2, ChronoUnit.HOURS));
        notifications.pushAt(first.getId(), workspace.getId(), "overdue",
                "Overdue follow-up", "Security docs for Initech were due 31 May.",
                "/follow-ups", Instant.now().minus(5, ChronoUnit.HOURS));
    }

    private String emailFor(String name, String company) {
        if ("Lucas Carter".equals(name)) return "lucas@massivedynamic.com";
        String local = name.toLowerCase(Locale.ROOT).replace(" ", ".");
        String domain = company.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        return local + "@" + domain + ".com";
    }
}
