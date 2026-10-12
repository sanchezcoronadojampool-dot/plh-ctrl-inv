package com.plh.condominio.dto;

import com.plh.condominio.entity.ItemCondition;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AssetAssignRequest(
        @NotNull Long areaId,
        Long responsibleId,
        @Size(max = 120) String responsibleName,
        @NotNull Long issuedById,
        @NotNull ItemCondition condition,
        String reason
) {
}
