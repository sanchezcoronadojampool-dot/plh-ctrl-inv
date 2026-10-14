package com.plh.condominio.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import com.plh.condominio.entity.BorrowerType;

public record LoanRequest(
        Long borrowerId,
        Long borrowerPersonId,
        BorrowerType borrowerType,
        String borrowerName,
        @NotNull Long issuedById,
        @NotNull Long areaId,
        String purpose,
        LocalDate dueAt,
        @NotEmpty List<@Valid LoanItemRequest> items
) {
    public LoanRequest(Long borrowerId, Long issuedById, Long areaId, String purpose, LocalDate dueAt,
            List<LoanItemRequest> items) {
        this(borrowerId, null, borrowerId == null ? null : BorrowerType.EMPLOYEE, null,
                issuedById, areaId, purpose, dueAt, items);
    }
}
