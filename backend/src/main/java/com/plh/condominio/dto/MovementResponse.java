package com.plh.condominio.dto;

import com.plh.condominio.entity.MovementType;
import com.plh.condominio.entity.MovementPurpose;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record MovementResponse(
        Long id,
        Long productId,
        String productName,
        Long userId,
        String userName,
        Long recipientId,
        String recipientName,
        Long areaId,
        String areaName,
        Long assetId,
        String assetCode,
        String loanNumber,
        MovementType type,
        BigDecimal quantity,
        MovementPurpose purpose,
        String reason,
        String vehicleEquipment,
        String conditionBefore,
        String conditionAfter,
        LocalDate movementDate,
        LocalDateTime createdAt
) {
}
