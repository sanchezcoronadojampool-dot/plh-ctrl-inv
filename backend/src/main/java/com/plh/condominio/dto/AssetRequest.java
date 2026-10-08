package com.plh.condominio.dto;

import com.plh.condominio.entity.ItemCondition;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AssetRequest(
        @NotNull Long productId,
        @NotBlank String assetCode,
        String serialNumber,
        @NotNull Long areaId,
        @NotNull Long responsibleId,
        @NotNull Long recordedById,
        @NotNull ItemCondition condition
) {
}
