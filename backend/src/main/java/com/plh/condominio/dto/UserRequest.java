package com.plh.condominio.dto;

import com.plh.condominio.entity.AccessRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;

public record UserRequest(
        @NotBlank @Size(max = 120) String fullName,
        @NotBlank @Size(max = 80) String jobTitle,
        @NotNull AccessRole role,
        @NotBlank @Email @Size(max = 120) String email,
        @Pattern(regexp = "^$|^.{12,72}$", message = "La contraseña debe tener entre 12 y 72 caracteres.") String password
) {
}
