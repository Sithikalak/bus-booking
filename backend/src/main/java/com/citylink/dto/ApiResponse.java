package com.citylink.dto;

public record ApiResponse<T>(
  boolean success,
  String message,
  T data,
  String errorCode
) {
  public static <T> ApiResponse<T> ok(T data) {
    return new ApiResponse<>(true, "Success", data, null);
  }

  public static ApiResponse<Void> error(String message, String code) {
    return new ApiResponse<>(false, message, null, code);
  }
}
