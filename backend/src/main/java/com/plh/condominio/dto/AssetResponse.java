package com.plh.condominio.dto;

import com.plh.condominio.entity.AssetStatus;
import com.plh.condominio.entity.ItemCondition;

public record AssetResponse(
        Long id,
        String qrToken,
        String assetCode,
        String serialNumber,
        Long productId,
        String productName,
        String productCode,
        Long areaId,
        String areaName,
        Long responsibleId,
        String responsibleName,
        ItemCondition condition,
        AssetStatus status
) {
}
