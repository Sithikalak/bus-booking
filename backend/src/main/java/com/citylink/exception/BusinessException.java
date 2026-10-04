package com.citylink.exception;

public class BusinessException extends RuntimeException {

  public final String code;
  public final int status;

  public BusinessException(String code, String message) {
    this(code, message, 409);
  }

  public BusinessException(String code, String message, int status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
