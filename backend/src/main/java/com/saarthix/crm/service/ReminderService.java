package com.saarthix.crm.service;

import com.saarthix.crm.model.FollowUp;
import com.saarthix.crm.model.User;
import com.saarthix.crm.repo.FollowUpRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
public class ReminderService {
    private final FollowUpRepository tasks;
    private final NotificationService notifications;

    public ReminderService(FollowUpRepository tasks, NotificationService notifications) {
        this.tasks = tasks;
        this.notifications = notifications;
    }

    /** Morning sweep: one notification per task that is due today or already overdue. */
    @Scheduled(cron = "${app.reminders.cron:0 0 8 * * *}")
    public void morningSweep() {
        run();
    }

    /** Sends the "15 minutes / 1 hour / 1 day before" reminders chosen when a follow-up was scheduled. */
    @Scheduled(fixedDelayString = "${app.reminders.poll-ms:60000}")
    public void timedReminders() {
        Instant now = Instant.now();
        for (FollowUp task : tasks.findByRemindAtLessThanEqualAndReminderSentAtIsNullAndStatusNot(now, "Completed")) {
            if ("Pending Approval".equals(task.getApprovalStatus())) continue;
            String when = task.getDueTime() == null ? task.getDueDate() : task.getDueDate() + " at " + task.getDueTime();
            String body = task.getTitle()
                    + (task.getLeadName() == null || task.getLeadName().isBlank() ? "" : " · " + task.getLeadName())
                    + " · " + when;
            String link = "/calendar?event=" + task.getId();
            notifications.push(task.getAssigneeId(), task.getWorkspaceId(), "due", "Reminder: " + task.getTitle(), body, link);
            task.setReminderSentAt(now);
            tasks.save(task);
        }
    }

    public Map<String, Object> run() {
        LocalDate today = LocalDate.now();
        String stamp = today.toString();
        List<FollowUp> open = tasks.findByStatusNot("Completed");
        int sent = 0;
        for (FollowUp task : open) {
            if (task.getDueDate() == null || task.getDueDate().isBlank()) continue;
            if (stamp.equals(task.getRemindedOn())) continue;
            LocalDate due;
            try {
                due = LocalDate.parse(task.getDueDate());
            } catch (Exception ex) {
                continue;
            }
            if (due.isAfter(today)) continue;
            if ("Pending Approval".equals(task.getApprovalStatus())) continue;

            boolean overdue = due.isBefore(today);
            String title = overdue ? "Overdue follow-up" : "Due today";
            String body = task.getTitle()
                    + (task.getLeadName() == null || task.getLeadName().isBlank() ? "" : " · " + task.getLeadName())
                    + (overdue ? " was due " + task.getDueDate() : "");
            notifications.push(task.getAssigneeId(), task.getWorkspaceId(),
                    overdue ? "overdue" : "due", title, body, "/calendar?event=" + task.getId());
            task.setRemindedOn(stamp);
            tasks.save(task);
            sent++;
        }
        return Map.of("reminders", sent, "checked", open.size(), "date", stamp);
    }

    public void runForUser(User user) {
        if (user == null || user.getId() == null) return;
        LocalDate today = LocalDate.now();
        String stamp = today.toString();
        tasks.findByStatusNot("Completed").stream()
                .filter(task -> !"Pending Approval".equals(task.getApprovalStatus()))
                .filter(task -> user.getId().equals(task.getAssigneeId()) || user.getId().equals(task.getOwnerId()))
                .filter(task -> stamp.equals(task.getDueDate()) || FollowUpService.overdue(task, today))
                .filter(task -> !stamp.equals(task.getRemindedOn()))
                .forEach(task -> {
                    boolean overdue = FollowUpService.overdue(task, today);
                    notifications.push(user.getId(), task.getWorkspaceId(),
                            overdue ? "overdue" : "due",
                            overdue ? "Overdue follow-up" : "Due today",
                            task.getTitle(), "/calendar?event=" + task.getId());
                    task.setRemindedOn(stamp);
                    tasks.save(task);
                });
    }
}
