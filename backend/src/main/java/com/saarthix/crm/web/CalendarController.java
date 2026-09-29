package com.saarthix.crm.web;

import com.saarthix.crm.model.MeetingLog;
import com.saarthix.crm.service.CalendarService;
import com.saarthix.crm.service.FollowUpService;
import com.saarthix.crm.service.MeetingLogService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/calendar")
public class CalendarController {
    private final CalendarService calendar;

    public CalendarController(CalendarService calendar) {
        this.calendar = calendar;
    }

    @GetMapping
    public Map<String, Object> range(@RequestParam String from,
                                     @RequestParam String to,
                                     @RequestParam(required = false) String assigneeId,
                                     @RequestParam(required = false) String type) {
        return calendar.range(from, to, assigneeId, type);
    }

    @GetMapping("/{id}")
    public Map<String, Object> one(@PathVariable String id) {
        return calendar.one(id);
    }

    @PostMapping
    public Map<String, Object> create(@Valid @RequestBody FollowUpService.TaskRequest request) {
        return calendar.create(request);
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable String id, @Valid @RequestBody FollowUpService.TaskRequest request) {
        return calendar.update(id, request);
    }

    @GetMapping("/{id}/log")
    public MeetingLog getLog(@PathVariable String id) {
        return calendar.getLog(id);
    }

    @PostMapping("/{id}/log")
    public MeetingLog saveLog(@PathVariable String id, @Valid @RequestBody MeetingLogService.LogRequest request) {
        return calendar.log(id, request);
    }
}
