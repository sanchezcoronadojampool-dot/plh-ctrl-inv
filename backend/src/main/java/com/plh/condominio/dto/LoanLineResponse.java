package com.plh.condominio.dto;

import com.plh.condominio.entity.ItemCondition;
import java.math.BigDecimal;
import java.util.List;

public record LoanLineResponse(
        Long id,
        Long productId,
        String productName,
        String productCode,
        BigDecimal quantity,
        BigDecimal returnedQuantity,
        BigDecimal outstandingQuantity,
        ItemCondition conditionOut,
        List<AssetResponse> assets
) {
}
