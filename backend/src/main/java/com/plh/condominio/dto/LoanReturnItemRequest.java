package com.plh.condominio.dto;

import com.plh.condominio.entity.ItemCondition;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

public record LoanReturnItemRequest(
        @NotNull Long loanLineId,
        @NotNull @DecimalMin("0.001") @Digits(integer = 11, fraction = 3) BigDecimal quantity,
        @NotNull ItemCondition condition,
        List<Long> assetIds
) {
}
