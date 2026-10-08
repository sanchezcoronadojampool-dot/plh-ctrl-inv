package com.plh.condominio.dto;

import java.math.BigDecimal;
import java.util.Map;

public record InventorySummaryDto(
        long totalProducts,
        Map<String, BigDecimal> stocksByUnit,
        long lowStockCount,
        long movementsToday
) {
}
