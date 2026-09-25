package com.saarthix.crm.service;

import com.saarthix.crm.model.User;
import com.saarthix.crm.model.Workspace;
import com.saarthix.crm.repo.UserRepository;
import com.saarthix.crm.repo.WorkspaceRepository;
import com.saarthix.crm.security.CurrentUser;
import com.saarthix.crm.security.JwtService;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AuthService {
    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private final UserRepository users;
    private final WorkspaceRepository workspaces;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final CurrentUser current;
    private final ReminderService reminders;

    public AuthService(UserRepository users, WorkspaceRepository workspaces, PasswordEncoder encoder,
                       JwtService jwt, CurrentUser current, ReminderService reminders) {
        this.users = users;
        this.workspaces = workspaces;
        this.encoder = encoder;
        this.jwt = jwt;
        this.current = current;
        this.reminders = reminders;
    }

    public Map<String, Object> register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with that email already exists");
        }
        User user = new User();
        user.setName(request.name().trim());
        user.setEmail(email);
        user.setPasswordHash(encoder.encode(request.password()));
        user.setCompany(request.company() == null ? "" : request.company().trim());
        user.setTitle(request.title() == null ? "" : request.title().trim());
        user.setCreatedAt(Instant.now());
        String invite = request.inviteCode() == null ? "" : request.inviteCode().trim();
        if (!invite.isBlank()) {
            Workspace workspace = workspaces.findByInviteCodeIgnoreCase(invite)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "That invite code is not valid"));
            user.setWorkspaceId(workspace.getId());
            user.setRole("REP");
            if (user.getCompany() == null || user.getCompany().isBlank()) {
                user.setCompany(workspace.getName());
            }
        } else {
            Workspace workspace = newWorkspace(request.company() == null || request.company().isBlank()
                    ? user.getName() + " workspace"
                    : request.company().trim());
            user.setWorkspaceId(workspace.getId());
            user.setRole("ADMIN");
        }
        users.save(user);
        return token(user);
    }

    public Map<String, Object> login(LoginRequest request) {
        User user = users.findByEmailIgnoreCase(request.email().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        if (!encoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        reminders.runForUser(user);
        return token(user);
    }

    public Map<String, Object> me() {
        return profile(current.get());
    }

    public Map<String, Object> update(ProfileRequest request) {
        User user = current.get();
        if (request.name() != null && !request.name().isBlank()) {
            user.setName(request.name().trim());
        }
        if (request.company() != null) {
            user.setCompany(request.company().trim());
        }
        if (request.title() != null) {
            user.setTitle(request.title().trim());
        }
        users.save(user);
        return profile(user);
    }

    public Workspace newWorkspace(String name) {
        Workspace workspace = new Workspace();
        workspace.setName(name);
        workspace.setInviteCode(uniqueCode());
        workspace.setCreatedAt(Instant.now());
        return workspaces.save(workspace);
    }

    private String uniqueCode() {
        SecureRandom random = new SecureRandom();
        for (int attempt = 0; attempt < 12; attempt++) {
            StringBuilder code = new StringBuilder("SX-");
            for (int i = 0; i < 6; i++) {
                code.append(CODE_CHARS.charAt(random.nextInt(CODE_CHARS.length())));
            }
            String value = code.toString();
            if (workspaces.findByInviteCodeIgnoreCase(value).isEmpty()) {
                return value;
            }
        }
        return "SX-" + Long.toString(System.currentTimeMillis(), 36).toUpperCase();
    }

    private Map<String, Object> token(User user) {
        return Map.of(
                "token", jwt.generate(user.getId(), user.getEmail()),
                "user", profile(user));
    }

    public Map<String, Object> profile(User user) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", user.getId());
        body.put("name", user.getName());
        body.put("email", user.getEmail());
        body.put("company", user.getCompany() == null ? "" : user.getCompany());
        body.put("title", user.getTitle() == null ? "" : user.getTitle());
        body.put("role", user.getRole() == null ? "REP" : user.getRole());
        body.put("workspaceId", user.getWorkspaceId() == null ? "" : user.getWorkspaceId());
        body.put("workspaceName", workspaces.findById(user.getWorkspaceId() == null ? "" : user.getWorkspaceId())
                .map(Workspace::getName).orElse(""));
        return body;
    }

    public record LoginRequest(
            @NotBlank(message = "Email is required") @Email(message = "Enter a valid email") String email,
            @NotBlank(message = "Password is required") String password) {
    }

    public record RegisterRequest(
            @NotBlank(message = "Name is required") String name,
            @NotBlank(message = "Email is required") @Email(message = "Enter a valid email") String email,
            @NotBlank(message = "Password is required")
            @Size(min = 8, message = "Password must be at least 8 characters") String password,
            String company,
            String title,
            String inviteCode) {
    }

    public record ProfileRequest(String name, String company, String title) {
    }
}
