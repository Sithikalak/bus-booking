package com.citylink.exception;

import com.citylink.dto.ApiResponse;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(BusinessException.class)
  ResponseEntity<?> business(BusinessException e) {
    return ResponseEntity.status(e.status).body(
      ApiResponse.error(e.getMessage(), e.code)
    );
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<?> validation(MethodArgumentNotValidException e) {
    var f = e.getBindingResult().getFieldErrors().get(0);
    return ResponseEntity.badRequest().body(
      ApiResponse.error(
        f.getField() + ": " + f.getDefaultMessage(),
        "VALIDATION_ERROR"
      )
    );
  }

  @ExceptionHandler({
    IllegalArgumentException.class,
    HttpMessageNotReadableException.class,
  })
  ResponseEntity<?> malformed(Exception e) {
    return ResponseEntity.badRequest().body(
      ApiResponse.error(
        "Please check the request fields and date format.",
        "INVALID_REQUEST"
      )
    );
  }

  @ExceptionHandler(AccessDeniedException.class)
  ResponseEntity<?> denied(Exception e) {
    return ResponseEntity.status(403).body(
      ApiResponse.error(
        "You do not have permission for this action.",
        "FORBIDDEN"
      )
    );
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<?> duplicate(Exception e) {
    return ResponseEntity.status(409).body(
      ApiResponse.error(
        "A matching record already exists, or this change conflicts with related records.",
        "DATA_CONFLICT"
      )
    );
  }

  @ExceptionHandler(PessimisticLockingFailureException.class)
  ResponseEntity<?> busy(Exception e) {
    return ResponseEntity.status(409).body(
      ApiResponse.error(
        "This resource is being updated. Please try again.",
        "RESOURCE_BUSY"
      )
    );
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<?> other(Exception e) {
    LoggerFactory.getLogger(getClass()).error("Request failed", e);
    return ResponseEntity.internalServerError().body(
      ApiResponse.error(
        "We could not complete this request. Please try again.",
        "INTERNAL_ERROR"
      )
    );
  }
}
