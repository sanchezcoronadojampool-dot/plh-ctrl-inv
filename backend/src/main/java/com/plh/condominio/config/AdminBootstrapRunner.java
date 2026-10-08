package com.plh.condominio.config;

import com.plh.condominio.entity.AccessRole;
import com.plh.condominio.entity.User;
import com.plh.condominio.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Component
@Profile("!demo")
public class AdminBootstrapRunner implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    @Value("${app.bootstrap.admin.email:}")
    private String adminEmail;
    @Value("${app.bootstrap.admin.name:}")
    private String adminName;
    @Value("${app.bootstrap.admin.password:}")
    private String adminPassword;

    public AdminBootstrapRunner(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (userRepository.countByRoleAndEnabledTrue(AccessRole.ADMIN) > 0) return;
        if (adminEmail.isBlank() || adminEmail.length() > 120 || !adminEmail.contains("@")
                || adminName.isBlank() || adminName.length() > 120
                || adminPassword.length() < 12 || adminPassword.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalStateException("No existe un administrador. Configure un correo y nombre válidos, y una BOOTSTRAP_ADMIN_PASSWORD de al menos 12 caracteres y no más de 72 bytes UTF-8.");
        }

        String normalizedEmail = adminEmail.trim().toLowerCase(Locale.ROOT);
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail).orElseGet(User::new);
        user.setFullName(adminName.trim());
        user.setJobTitle("Administrador del sistema");
        user.setRole(AccessRole.ADMIN);
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(adminPassword));
        user.setEnabled(true);
        userRepository.save(user);
    }
}
