package com.plh.condominio.dto;

import com.plh.condominio.entity.TrackingType;
import java.math.BigDecimal;

public record ProductResponse(
        Long id,
        String code,
        String name,
        String category,
        BigDecimal stock,
        BigDecimal minimumStock,
        String location,
        String unit,
        Boolean active,
        TrackingType trackingType,
        BigDecimal availableStock
) {
}
