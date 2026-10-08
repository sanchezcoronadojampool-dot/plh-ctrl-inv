package com.plh.condominio.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record StockLedgerEntryResponse(
        Long id,
        Long productId,
        String productName,
        Long movementId,
        String actorName,
        String eventType,
        BigDecimal quantityDelta,
        BigDecimal balanceAfter,
        String reason,
        LocalDateTime createdAt
) {
}
