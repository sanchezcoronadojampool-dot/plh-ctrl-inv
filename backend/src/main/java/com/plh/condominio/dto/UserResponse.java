package com.plh.condominio.dto;

import com.plh.condominio.entity.AccessRole;

public record UserResponse(
        Long id,
        String fullName,
        String jobTitle,
        AccessRole role,
        String email,
        boolean enabled
) {
}
