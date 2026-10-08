package com.plh.condominio.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

public record LoanRequest(
        @NotNull Long borrowerId,
        @NotNull Long issuedById,
        @NotNull Long areaId,
        @NotBlank String purpose,
        LocalDate dueAt,
        @NotEmpty List<@Valid LoanItemRequest> items
) {
}
