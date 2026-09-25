package com.saarthix.crm.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.saarthix.crm.domain.Catalog;
import com.saarthix.crm.domain.LeadScore;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.repo.LeadRepository;
import com.saarthix.crm.security.Scope;
import jakarta.validation.constraints.NotBlank;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AiService {
    private final LeadRepository leads;
    private final Scope scope;
    private final MailService mail;
    private final ActivityService activities;
    private final ObjectMapper mapper;
    private final String apiKey;
    private final String model;

    public AiService(
            LeadRepository leads,
            Scope scope,
            MailService mail,
            ActivityService activities,
            ObjectMapper mapper,
            @Value("${app.gemini.api-key:}") String apiKey,
            @Value("${app.gemini.model:gemini-2.0-flash}") String model) {
        this.leads = leads;
        this.scope = scope;
        this.mail = mail;
        this.activities = activities;
        this.mapper = mapper;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model;
    }

    public Map<String, Object> email(EmailRequest request) {
        Catalog.require(request.purpose(), Catalog.PURPOSES, "Purpose");
        Catalog.require(request.tone(), Catalog.TONES, "Tone");
        Lead lead = owned(request.leadId());
        String prompt = """
                Write a sales email for the CRM user.
                Return JSON only, with keys subject and body. Body is plain text with short paragraphs.
                Purpose: %s
                Tone: %s
                Recipient: %s
                Company: %s
                Deal value USD: %s
                Stage: %s
                Priority: %s
                Source: %s
                Notes: %s
                Do not invent discounts, contracts, or meetings that are not in the notes.
                """.formatted(
                safe(request.purpose()), safe(request.tone()), safe(lead.getName()), safe(empty(lead.getCompany())),
                lead.getValue(), safe(lead.getStage()), safe(lead.getPriority()), safe(lead.getSource()), safe(empty(lead.getNotes())));
        String raw = gemini(prompt);
        if (raw != null) {
            Parsed parsed = parseEmail(raw);
            if (parsed != null) {
                return Map.of("subject", parsed.subject(), "body", parsed.body(), "provider", "gemini");
            }
        }
        return Map.of(
                "subject", fallbackSubject(lead, request.purpose()),
                "body", fallbackBody(lead, request.purpose(), request.tone()),
                "provider", "saarthix",
                "mailReady", mail.configured());
    }

    public Map<String, Object> send(SendRequest request) {
        Lead lead = owned(request.leadId());
        mail.send(lead.getEmail(), request.subject(), request.body(), scope.user().getEmail());
        activities.log(lead, scope.user(), "email", "Email sent: " + request.subject(), request.body());
        return Map.of("sent", true, "to", lead.getEmail(), "subject", request.subject());
    }

    public Map<String, Object> mailStatus() {
        return Map.of("configured", mail.configured(), "inboxUrl", mail.inboxUrl());
    }

    public Map<String, Object> summary(IdRequest request) {
        Lead lead = owned(request.leadId());
        String prompt = """
                In 2 short sentences, summarize this sales lead for a rep about to open the record.
                Mention stage, value, and the single most useful next context from the notes. No bullet list.
                Name: %s, Company: %s, Value: %s, Stage: %s, Priority: %s, Source: %s, Notes: %s
                """.formatted(safe(lead.getName()), safe(empty(lead.getCompany())), lead.getValue(), safe(lead.getStage()),
                safe(lead.getPriority()), safe(lead.getSource()), safe(empty(lead.getNotes())));
        String raw = gemini(prompt);
        String text = raw == null || raw.isBlank() ? fallbackSummary(lead) : raw.trim();
        return Map.of("summary", text, "score", LeadScore.of(lead), "provider", raw == null ? "saarthix" : "gemini");
    }

    public Map<String, Object> nextStep(IdRequest request) {
        Lead lead = owned(request.leadId());
        String prompt = """
                Give one concrete next step for this deal, in a single sentence a salesperson can do this week.
                Name: %s, Company: %s, Value USD: %s, Stage: %s, Priority: %s, Notes: %s
                """.formatted(safe(lead.getName()), safe(empty(lead.getCompany())), lead.getValue(), safe(lead.getStage()),
                safe(lead.getPriority()), safe(empty(lead.getNotes())));
        String raw = gemini(prompt);
        String text = raw == null || raw.isBlank() ? fallbackNext(lead) : raw.trim();
        return Map.of("suggestion", text, "provider", raw == null ? "saarthix" : "gemini");
    }

    public Map<String, Object> pipeline() {
        List<Lead> all = leads.findByWorkspaceId(scope.workspaceId());
        long open = all.stream().filter(l -> Catalog.isOpen(l.getStage())).mapToLong(Lead::getValue).sum();
        long openCount = all.stream().filter(l -> Catalog.isOpen(l.getStage())).count();
        Lead largest = all.stream().filter(l -> Catalog.isOpen(l.getStage()))
                .max((a, b) -> Long.compare(a.getValue(), b.getValue())).orElse(null);
        String focus = largest == null
                ? "Add your first lead and the co-pilot will start reading the pipeline."
                : "Largest open deal is " + largest.getName() + " at " + empty(largest.getCompany())
                + " (" + largest.getStage() + "). Start there, then clear overdue follow-ups before opening new outreach.";
        String text = all.isEmpty()
                ? "Your pipeline is empty. Add a lead and the co-pilot will start reading your book of deals."
                : "You have " + openCount + " open deals worth about $" + String.format(Locale.US, "%,d", open)
                + ". " + focus;
        return Map.of("summary", text, "provider", "saarthix");
    }

    private Lead owned(String id) {
        return leads.findById(id)
                .filter(lead -> scope.sameWorkspace(lead.getWorkspaceId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lead not found"));
    }

    private String gemini(String prompt) {
        if (apiKey.isBlank()) return null;
        try {
            String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;
            Map<String, Object> body = Map.of(
                    "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))));
            String json = RestClient.create().post().uri(url).body(body).retrieve().body(String.class);
            JsonNode text = mapper.readTree(json).path("candidates").path(0).path("content").path("parts").path(0).path("text");
            return text.isMissingNode() ? null : text.asText();
        } catch (Exception ex) {
            return null;
        }
    }

    private Parsed parseEmail(String raw) {
        try {
            String cleaned = raw.trim();
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replaceAll("^```(?:json)?", "").replaceAll("```$", "").trim();
            }
            int start = cleaned.indexOf('{');
            int end = cleaned.lastIndexOf('}');
            if (start >= 0 && end > start) cleaned = cleaned.substring(start, end + 1);
            JsonNode node = mapper.readTree(cleaned);
            String subject = node.path("subject").asText("");
            String body = node.path("body").asText("");
            if (subject.isBlank() || body.isBlank()) return null;
            return new Parsed(subject, body);
        } catch (Exception ex) {
            return null;
        }
    }

    private String fallbackSubject(Lead lead, String purpose) {
        String first = lead.getName().split(" ")[0];
        return switch (purpose) {
            case "Introduction" -> "Introduction from SaarthiX, " + first;
            case "Proposal" -> "Proposal for " + empty(lead.getCompany());
            case "Check-in" -> "Checking in, " + first;
            case "Closing" -> "Next step to move " + empty(lead.getCompany()) + " forward";
            default -> "Following up, " + first;
        };
    }

    private String fallbackBody(Lead lead, String purpose, String tone) {
        String first = lead.getName().split(" ")[0];
        String company = empty(lead.getCompany());
        String greeting = "Formal".equals(tone) ? "Dear " + lead.getName() + "," : "Hi " + first + ",";
        String sign = "Formal".equals(tone) ? "Kind regards" : "Best";
        String note = lead.getNotes() == null || lead.getNotes().isBlank()
                ? "I wanted to keep this in front of you while the conversation is fresh."
                : "From our notes: " + lead.getNotes();
        String ask = switch (purpose) {
            case "Introduction" -> "I work with teams who want a clearer view of pipeline, follow-ups, and the next conversation. I would value 20 minutes to see if that is useful for " + company + ".";
            case "Proposal" -> "I have the " + lead.getStage().toLowerCase(Locale.ROOT) + " conversation at $" + String.format(Locale.US, "%,d", lead.getValue()) + " in mind. I can send a short proposal this week if you confirm the scope and the person who signs.";
            case "Check-in" -> "I am checking that nothing is blocked on your side. If the timing has shifted, tell me the date that works and I will plan around it.";
            case "Closing" -> "If the value still holds, the useful next step is a decision date and the stakeholder who needs to see the final note. I can work to that date.";
            default -> "I am following up so this does not go quiet. A short reply with where " + company + " stands is enough for me to prepare the right next step.";
        };
        if ("Concise".equals(tone)) {
            return greeting + "\n\n" + ask + "\n\n" + sign;
        }
        return greeting + "\n\n" + ask + "\n\n" + note + "\n\n" + sign;
    }

    private String fallbackSummary(Lead lead) {
        return lead.getName() + " at " + empty(lead.getCompany()) + " is a " + lead.getPriority().toLowerCase(Locale.ROOT)
                + "-priority " + lead.getStage().toLowerCase(Locale.ROOT) + " deal worth $"
                + String.format(Locale.US, "%,d", lead.getValue()) + ", sourced from " + lead.getSource() + ". "
                + (lead.getNotes() == null || lead.getNotes().isBlank()
                ? "Add a note so the next rep knows the context before they write."
                : lead.getNotes());
    }

    private String fallbackNext(Lead lead) {
        return switch (lead.getStage()) {
            case "Qualified" -> "Send a one-page scope for the $" + String.format(Locale.US, "%,d", lead.getValue()) + " conversation and ask " + lead.getName().split(" ")[0] + " for a decision date.";
            case "Proposal" -> "Follow up on the open proposal, name the internal champion, and confirm who else must approve.";
            case "Won" -> "Schedule onboarding and ask for one referral while the win is still fresh.";
            case "Lost" -> "Send a short note thanking them and ask what would need to change to reopen the deal.";
            default -> "Book a discovery call this week and write down the problem " + empty(lead.getCompany()) + " wants solved.";
        };
    }

    private String empty(String value) {
        return value == null || value.isBlank() ? "their company" : value;
    }

    private String safe(String value) {
        return value == null ? "" : value.replace("%", "percent");
    }

    private record Parsed(String subject, String body) {
    }

    public record EmailRequest(@NotBlank String leadId, @NotBlank String purpose, @NotBlank String tone) {
    }

    public record IdRequest(@NotBlank String leadId) {
    }

    public record SendRequest(
            @NotBlank String leadId,
            @NotBlank(message = "Subject is required") String subject,
            @NotBlank(message = "Write the email before sending") String body) {
    }
}
