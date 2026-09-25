package com.saarthix.crm.repo;

import com.saarthix.crm.model.Note;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface NoteRepository extends MongoRepository<Note, String> {
    List<Note> findByWorkspaceId(String workspaceId);
    List<Note> findByWorkspaceIdAndLinkedId(String workspaceId, String linkedId);
    List<Note> findByOwnerId(String ownerId);
    List<Note> findByOwnerIdAndLinkedId(String ownerId, String linkedId);
}
