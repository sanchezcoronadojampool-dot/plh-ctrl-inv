package com.plh.condominio.dto;

import java.util.List;

public record BulkProductRequest(List<ProductRequest> products) {
}
