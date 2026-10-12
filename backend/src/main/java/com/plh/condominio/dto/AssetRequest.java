package com.plh.condominio.dto;

import com.plh.condominio.entity.ItemCondition;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AssetRequest(
        @NotNull Long productId,
        @NotBlank String assetCode,
        String serialNumber,
        @NotNull Long areaId,
        Long responsibleId,
        @Size(max = 120) String responsibleName,
        @NotNull Long recordedById,
        @NotNull ItemCondition condition
) {
}
