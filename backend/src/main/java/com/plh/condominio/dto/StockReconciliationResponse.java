package com.plh.condominio.dto;

import java.math.BigDecimal;

public record StockReconciliationResponse(
        Long productId,
        String productCode,
        String productName,
        BigDecimal ledgerBalance,
        BigDecimal currentStock,
        BigDecimal difference
) {
}
