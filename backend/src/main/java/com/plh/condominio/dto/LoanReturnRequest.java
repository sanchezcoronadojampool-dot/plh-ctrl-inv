package com.plh.condominio.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record LoanReturnRequest(
        @NotNull Long receivedById,
        @NotNull Long returnedById,
        @NotNull Long areaId,
        @NotEmpty List<@Valid LoanReturnItemRequest> items
) {
}
