package com.saarthix.crm.web;

import com.saarthix.crm.model.Lead;
import com.saarthix.crm.service.LeadService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/leads")
public class LeadController {
    private final LeadService leads;

    public LeadController(LeadService leads) {
        this.leads = leads;
    }

    @GetMapping
    public Map<String, Object> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String owner,
            @RequestParam(required = false) String sort) {
        return leads.list(q, stage, priority, source, owner, sort);
    }

    @PostMapping
    public Lead create(@Valid @RequestBody LeadService.LeadRequest request,
                       @RequestParam(defaultValue = "false") boolean force) {
        return leads.create(request, force);
    }

    @PostMapping("/import")
    public Map<String, Object> importCsv(@RequestBody LeadService.ImportRequest request) {
        return leads.importCsv(request);
    }

    @GetMapping("/{id}")
    public Lead get(@PathVariable String id) {
        return leads.get(id);
    }

    @GetMapping("/{id}/activity")
    public Map<String, Object> detail(@PathVariable String id) {
        return leads.detail(id);
    }

    @PutMapping("/{id}")
    public Lead update(@PathVariable String id, @Valid @RequestBody LeadService.LeadRequest request,
                       @RequestParam(defaultValue = "false") boolean force) {
        return leads.update(id, request, force);
    }

    @PatchMapping("/{id}/stage")
    public Lead stage(@PathVariable String id, @Valid @RequestBody LeadService.StageRequest request) {
        return leads.move(id, request);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        leads.delete(id);
    }

    @PostMapping("/bulk-delete")
    public Map<String, Object> bulk(@RequestBody LeadService.IdsRequest request) {
        return leads.bulkDelete(request);
    }
}
