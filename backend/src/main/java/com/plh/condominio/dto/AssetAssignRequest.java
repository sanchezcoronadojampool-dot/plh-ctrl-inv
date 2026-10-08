package com.plh.condominio.dto;

import com.plh.condominio.entity.ItemCondition;
import jakarta.validation.constraints.NotNull;

public record AssetAssignRequest(
        @NotNull Long areaId,
        @NotNull Long responsibleId,
        @NotNull Long issuedById,
        @NotNull ItemCondition condition,
        String reason
) {
}
