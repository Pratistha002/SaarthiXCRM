package com.saarthix.crm.web;

import com.saarthix.crm.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class AuthController {
    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/api/auth/register")
    public Map<String, Object> register(@Valid @RequestBody AuthService.RegisterRequest request) {
        return auth.register(request);
    }

    @PostMapping("/api/auth/login")
    public Map<String, Object> login(@Valid @RequestBody AuthService.LoginRequest request) {
        return auth.login(request);
    }

    @GetMapping("/api/auth/me")
    public Map<String, Object> me() {
        return auth.me();
    }

    @PatchMapping("/api/auth/me")
    public Map<String, Object> update(@RequestBody AuthService.ProfileRequest request) {
        return auth.update(request);
    }

    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}
