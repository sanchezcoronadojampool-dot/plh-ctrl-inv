package com.plh.condominio.dto;

public record BulkProductRowResponse(int row, String code, String name, String status, String message) {

    public static final String STATUS_CREATED = "CREATED";
    public static final String STATUS_SKIPPED = "SKIPPED";
    public static final String STATUS_ERROR = "ERROR";
}
