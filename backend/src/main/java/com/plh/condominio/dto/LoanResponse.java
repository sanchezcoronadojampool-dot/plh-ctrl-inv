package com.plh.condominio.dto;

import com.plh.condominio.entity.LoanStatus;
import com.plh.condominio.entity.BorrowerType;
import java.time.LocalDate;
import java.util.List;

public record LoanResponse(
        Long id,
        String loanNumber,
        Long borrowerId,
        String borrowerName,
        BorrowerType borrowerType,
        Long issuedById,
        String issuedByName,
        Long areaId,
        String areaName,
        String purpose,
        LocalDate issuedAt,
        LocalDate dueAt,
        LocalDate closedAt,
        LoanStatus status,
        List<LoanLineResponse> items
) {
}
