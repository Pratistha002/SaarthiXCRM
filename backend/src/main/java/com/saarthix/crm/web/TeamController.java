package com.saarthix.crm.web;

import com.saarthix.crm.service.TeamService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/team")
public class TeamController {
    private final TeamService team;

    public TeamController(TeamService team) {
        this.team = team;
    }

    @GetMapping
    public Map<String, Object> overview() {
        return team.overview();
    }

    @PostMapping
    public Map<String, Object> add(@Valid @RequestBody TeamService.MemberRequest request) {
        return team.addMember(request);
    }

    @PatchMapping("/{id}/role")
    public Map<String, Object> role(@PathVariable String id, @Valid @RequestBody TeamService.RoleRequest request) {
        return team.changeRole(id, request);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> remove(@PathVariable String id, @RequestParam(required = false) String reassignTo) {
        return team.removeMember(id, reassignTo);
    }
}
