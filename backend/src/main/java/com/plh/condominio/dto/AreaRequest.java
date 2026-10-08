package com.plh.condominio.dto;

import jakarta.validation.constraints.NotBlank;

public record AreaRequest(@NotBlank String name, String description) {
}
