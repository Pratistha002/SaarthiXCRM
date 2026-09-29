package com.saarthix.crm.service;

import com.saarthix.crm.model.Attachment;
import com.saarthix.crm.repo.AttachmentRepository;
import com.saarthix.crm.security.Scope;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Base64;
import java.util.Map;

@Service
public class AttachmentService {
    private static final long MAX_ATTACHMENT_BYTES = 5L * 1024 * 1024;

    private final AttachmentRepository attachments;
    private final Scope scope;

    public AttachmentService(AttachmentRepository attachments, Scope scope) {
        this.attachments = attachments;
        this.scope = scope;
    }

    /** Stores a base64 file against a lead or a deal. The caller has already checked access to the parent. */
    public Attachment store(String workspaceId, String leadId, String dealId, AttachmentRequest request) {
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(request.data());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The file could not be read");
        }
        if (bytes.length > MAX_ATTACHMENT_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Attachments must be 5 MB or smaller");
        }
        Attachment file = new Attachment();
        file.setWorkspaceId(workspaceId);
        file.setLeadId(leadId);
        file.setDealId(dealId);
        file.setFileName(request.fileName().trim());
        file.setContentType(request.contentType() == null || request.contentType().isBlank()
                ? "application/octet-stream" : request.contentType());
        file.setSize(bytes.length);
        file.setData(request.data());
        file.setUploadedBy(scope.user().getName());
        file.setCreatedAt(Instant.now());
        return attachments.save(file);
    }

    public Attachment find(String attachmentId, java.util.function.Predicate<Attachment> belongs) {
        return attachments.findById(attachmentId)
                .filter(file -> scope.sameWorkspace(file.getWorkspaceId()))
                .filter(belongs)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found"));
    }

    public Map<String, Object> download(Attachment file) {
        return Map.of("fileName", file.getFileName(), "contentType", file.getContentType(), "data", file.getData());
    }

    public void delete(Attachment file) {
        attachments.delete(file);
    }

    public record AttachmentRequest(
            @NotBlank(message = "File name is required") String fileName,
            String contentType,
            @NotBlank(message = "The file is empty") String data) {
    }
}
