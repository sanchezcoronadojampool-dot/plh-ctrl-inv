package com.plh.condominio.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import com.plh.condominio.entity.TrackingType;
import java.math.BigDecimal;

public record ProductRequest(
        @NotBlank String code,
        @NotBlank String name,
        @NotBlank String category,
        @NotNull @DecimalMin("0.000") @Digits(integer = 11, fraction = 3) BigDecimal stock,
        @NotNull @DecimalMin("0.000") @Digits(integer = 11, fraction = 3) BigDecimal minimumStock,
        @NotBlank String location,
        @NotBlank String unit,
        TrackingType trackingType
) {
}
