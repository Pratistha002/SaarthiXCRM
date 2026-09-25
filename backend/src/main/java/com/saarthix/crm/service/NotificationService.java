package com.saarthix.crm.service;

import com.saarthix.crm.model.AppNotification;
import com.saarthix.crm.repo.NotificationRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class NotificationService {
    private final NotificationRepository notifications;

    public NotificationService(NotificationRepository notifications) {
        this.notifications = notifications;
    }

    public void push(String userId, String workspaceId, String kind, String title, String body, String link) {
        AppNotification notification = new AppNotification();
        notification.setUserId(userId);
        notification.setWorkspaceId(workspaceId);
        notification.setKind(kind);
        notification.setTitle(title);
        notification.setBody(body);
        notification.setLink(link == null ? "" : link);
        notification.setRead(false);
        notification.setCreatedAt(Instant.now());
        notifications.save(notification);
    }

    public void pushAt(String userId, String workspaceId, String kind, String title, String body, String link, Instant at) {
        AppNotification notification = new AppNotification();
        notification.setUserId(userId);
        notification.setWorkspaceId(workspaceId);
        notification.setKind(kind);
        notification.setTitle(title);
        notification.setBody(body);
        notification.setLink(link == null ? "" : link);
        notification.setRead(false);
        notification.setCreatedAt(at);
        notifications.save(notification);
    }

    public List<AppNotification> forUser(String userId) {
        return notifications.findTop40ByUserIdOrderByCreatedAtDesc(userId);
    }
}
