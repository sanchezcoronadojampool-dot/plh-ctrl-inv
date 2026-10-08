package com.plh.condominio.dto;

import com.plh.condominio.entity.MovementType;
import com.plh.condominio.entity.ItemCondition;
import com.plh.condominio.entity.MovementPurpose;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record MovementRequest(
        @NotNull Long productId,
        @NotNull Long userId,
        Long recipientId,
        Long areaId,
        @NotNull MovementType type,
        @NotNull @DecimalMin("0.001") @Digits(integer = 11, fraction = 3) BigDecimal quantity,
        @Size(max = 200) String reason,
        LocalDate movementDate,
        MovementPurpose purpose,
        @Size(max = 120) String vehicleEquipment,
        ItemCondition condition
) {
}
