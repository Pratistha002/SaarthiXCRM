package com.saarthix.crm.config;

import com.saarthix.crm.model.User;
import com.saarthix.crm.model.Workspace;
import com.saarthix.crm.repo.UserRepository;
import com.saarthix.crm.repo.WorkspaceRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;

@Configuration
public class DataSeeder {
    @Bean
    CommandLineRunner seedDemo(UserRepository users, WorkspaceRepository workspaces,
                               PasswordEncoder encoder) {
        return args -> {
            Workspace workspace = workspaces.findByInviteCodeIgnoreCase("TEAM-SX26").orElseGet(() -> {
                Workspace created = new Workspace();
                created.setName("SaarthiX Sales");
                created.setInviteCode("TEAM-SX26");
                created.setCreatedAt(Instant.now());
                return workspaces.save(created);
            });
            upsert(users, encoder, workspace, "Alex Morgan", "alex@saarthix.com", "ADMIN", "Head of Sales");
            upsert(users, encoder, workspace, "Priya Shah", "priya@saarthix.com", "MANAGER", "Sales Manager");
            upsert(users, encoder, workspace, "Rohan Mehta", "rohan@saarthix.com", "REP", "Account Executive");
        };
    }

    private User upsert(UserRepository users, PasswordEncoder encoder, Workspace workspace,
                        String name, String email, String role, String title) {
        return users.findByEmailIgnoreCase(email).map(existing -> {
            boolean dirty = false;
            if (existing.getWorkspaceId() == null || existing.getWorkspaceId().isBlank()) {
                existing.setWorkspaceId(workspace.getId());
                dirty = true;
            }
            if (existing.getRole() == null || existing.getRole().isBlank()) {
                existing.setRole(role);
                dirty = true;
            }
            if (existing.getTitle() == null || existing.getTitle().isBlank()) {
                existing.setTitle(title);
                dirty = true;
            }
            if (existing.getName() == null || existing.getName().isBlank() || "Alex".equals(existing.getName())) {
                existing.setName(name);
                dirty = true;
            }
            return dirty ? users.save(existing) : existing;
        }).orElseGet(() -> {
            User created = new User();
            created.setName(name);
            created.setEmail(email);
            created.setPasswordHash(encoder.encode("Demo@123"));
            created.setCompany("SaarthiX");
            created.setWorkspaceId(workspace.getId());
            created.setRole(role);
            created.setTitle(title);
            created.setCreatedAt(Instant.now());
            return users.save(created);
        });
    }

    @Bean
    UserDetailsService userDetailsService() {
        return username -> {
            throw new UsernameNotFoundException(username);
        };
    }
}
