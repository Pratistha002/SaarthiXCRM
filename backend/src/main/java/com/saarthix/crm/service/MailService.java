package com.saarthix.crm.service;

import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MailService {
    private final JavaMailSender sender;
    private final String host;
    private final String from;
    private final String fromName;
    private final String inboxUrl;

    public MailService(
            JavaMailSender sender,
            @Value("${spring.mail.host:}") String host,
            @Value("${app.mail.from:}") String from,
            @Value("${app.mail.from-name:SaarthiX CRM}") String fromName,
            @Value("${app.mail.inbox-url:}") String inboxUrl) {
        this.sender = sender;
        this.host = host == null ? "" : host.trim();
        this.from = from == null ? "" : from.trim();
        this.fromName = fromName;
        this.inboxUrl = inboxUrl == null ? "" : inboxUrl.trim();
    }

    public boolean configured() {
        return !host.isBlank() && !from.isBlank();
    }

    public String inboxUrl() {
        return inboxUrl;
    }

    public void send(String to, String subject, String body, String replyTo) {
        if (!configured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Email sending is off. Set SPRING_MAIL_HOST, SPRING_MAIL_USERNAME, SPRING_MAIL_PASSWORD and APP_MAIL_FROM, then restart the backend.");
        }
        if (to == null || to.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This lead has no email address yet.");
        }
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(from, fromName);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(body, false);
            if (replyTo != null && !replyTo.isBlank()) {
                helper.setReplyTo(replyTo);
            }
            sender.send(message);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "The mail server rejected the message: " + ex.getMessage());
        }
    }
}
