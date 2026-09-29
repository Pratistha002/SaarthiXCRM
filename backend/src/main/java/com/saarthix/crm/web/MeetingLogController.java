package com.saarthix.crm.web;

import com.saarthix.crm.model.MeetingLog;
import com.saarthix.crm.service.MeetingLogService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/meeting-logs")
public class MeetingLogController {
    private final MeetingLogService logs;

    public MeetingLogController(MeetingLogService logs) {
        this.logs = logs;
    }

    @GetMapping
    public Map<String, Object> list(@RequestParam(required = false) String q,
                                    @RequestParam(required = false) String type,
                                    @RequestParam(required = false) String leadId) {
        return logs.list(q, type, leadId);
    }

    @GetMapping("/{id}")
    public MeetingLog one(@PathVariable String id) {
        return logs.get(id);
    }

    @PostMapping
    public MeetingLog create(@Valid @RequestBody CreateRequest request) {
        return logs.save(request.followUpId(), new MeetingLogService.LogRequest(
                request.attendees(),
                request.topicsDiscussed(),
                request.requirements(),
                request.feedback(),
                request.interestLevel(),
                request.decisions(),
                request.followUpAction(),
                request.nextFollowUpDate()));
    }

    public record CreateRequest(
            @NotBlank(message = "Pick a meeting, demo or visit to log") String followUpId,
            String attendees,
            @NotBlank(message = "Record what was discussed") String topicsDiscussed,
            String requirements,
            String feedback,
            @NotBlank(message = "Choose an interest level") String interestLevel,
            String decisions,
            String followUpAction,
            String nextFollowUpDate) {
    }
}
