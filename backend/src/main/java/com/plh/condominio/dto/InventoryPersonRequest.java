package com.plh.condominio.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InventoryPersonRequest(
        @NotBlank @Size(max = 120) String fullName,
        @NotBlank @Size(max = 80) String jobTitle
) {
}
