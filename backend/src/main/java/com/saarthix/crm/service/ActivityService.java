package com.saarthix.crm.service;

import com.saarthix.crm.model.Activity;
import com.saarthix.crm.model.Lead;
import com.saarthix.crm.model.User;
import com.saarthix.crm.repo.ActivityRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class ActivityService {
    private final ActivityRepository activities;

    public ActivityService(ActivityRepository activities) {
        this.activities = activities;
    }

    public void log(Lead lead, User actor, String type, String title, String detail) {
        Activity activity = new Activity();
        activity.setWorkspaceId(lead.getWorkspaceId());
        activity.setLeadId(lead.getId());
        activity.setType(type);
        activity.setTitle(title);
        activity.setDetail(detail == null ? "" : detail);
        activity.setActorId(actor == null ? "" : actor.getId());
        activity.setActorName(actor == null ? "SaarthiX" : actor.getName());
        activity.setCreatedAt(Instant.now());
        activities.save(activity);
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

    public void deleteForLead(String leadId) {
        activities.deleteByLeadId(leadId);
    }
}
