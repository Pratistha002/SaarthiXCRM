package com.saarthix.crm.service;

import com.saarthix.crm.model.Activity;
import com.saarthix.crm.model.CallLog;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.model.User;
import com.saarthix.crm.repo.ActivityRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class ActivityService {
    private final ActivityRepository activities;

    public ActivityService(ActivityRepository activities) {
        this.activities = activities;
    }

    public void log(Lead lead, User actor, String type, String title, String detail) {
        activities.save(build(lead, actor, type, title, detail));
    }

    public Activity logCall(Lead lead, User actor, String title, String detail, CallLog call) {
        Activity activity = build(lead, actor, "call", title, detail);
        activity.setCall(call);
        return activities.save(activity);
    }

    public Activity save(Activity activity) {
        return activities.save(activity);
    }

    public List<Activity> calls(String leadId) {
        return activities.findByLeadIdAndTypeOrderByCreatedAtDesc(leadId, "call");
    }

    public Optional<Activity> findCall(String leadId, String requestId) {
        if (requestId == null || requestId.isBlank()) return Optional.empty();
        return activities.findFirstByLeadIdAndCallRequestId(leadId, requestId);
    }

    private Activity build(Lead lead, User actor, String type, String title, String detail) {
        Activity activity = new Activity();
        activity.setWorkspaceId(lead.getWorkspaceId());
        activity.setLeadId(lead.getId());
        activity.setType(type);
        activity.setTitle(title);
        activity.setDetail(detail == null ? "" : detail);
        activity.setActorId(actor == null ? "" : actor.getId());
        activity.setActorName(actor == null ? "SaarthiX" : actor.getName());
        activity.setCreatedAt(Instant.now());
        return activity;
    }

    public void logAt(Lead lead, String actorName, String type, String title, String detail, Instant at) {
        Activity activity = new Activity();
        activity.setWorkspaceId(lead.getWorkspaceId());
        activity.setLeadId(lead.getId());
        activity.setType(type);
        activity.setTitle(title);
        activity.setDetail(detail == null ? "" : detail);
        activity.setActorId("");
        activity.setActorName(actorName);
        activity.setCreatedAt(at);
        activities.save(activity);
    }

    public List<Activity> forLead(String leadId) {
        return activities.findByLeadIdOrderByCreatedAtDesc(leadId);
    }

    public List<Activity> recent(String workspaceId) {
        return activities.findTop25ByWorkspaceIdOrderByCreatedAtDesc(workspaceId);
    }

    public List<Activity> recentAll() {
        return activities.findTop25ByOrderByCreatedAtDesc();
    }

    public void deleteForLead(String leadId) {
        activities.deleteByLeadId(leadId);
    }
}
