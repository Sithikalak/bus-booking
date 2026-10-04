package com.citylink.service;

import java.math.BigDecimal;

public interface PaymentGateway {
  record Result(boolean success, String reference, String message) {}

  Result charge(String paymentToken, BigDecimal amount, String idempotencyKey);
  Result refund(
    String transactionReference,
    BigDecimal amount,
    String idempotencyKey,
    boolean simulateFailure
  );
}
