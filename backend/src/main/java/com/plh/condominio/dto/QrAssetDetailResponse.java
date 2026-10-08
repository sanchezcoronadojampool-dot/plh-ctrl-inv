package com.plh.condominio.dto;

import java.util.List;

public record QrAssetDetailResponse(AssetResponse asset, List<MovementResponse> history) {
}
