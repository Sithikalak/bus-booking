package com.citylink.service;

import static com.citylink.util.Values.*;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = "app.development", havingValue = "true")
public class MockPaymentGateway implements PaymentGateway {

  public Result charge(String token, BigDecimal amount, String key) {
    oneOf(token, "mock_success", "mock_decline", "mock_refund_fail");
    boolean ok = !token.equals("mock_decline");
    return new Result(
      ok,
      "DEV-PAY-" + UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8)),
      ok
        ? "Development payment approved. No money was charged."
        : "The development gateway declined this payment. Try another test card or method."
    );
  }

  public Result refund(
    String reference,
    BigDecimal amount,
    String key,
    boolean fail
  ) {
    return new Result(
      !fail,
      "DEV-REF-" + UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8)),
      fail ? "Development refund failure." : "Development refund completed."
    );
  }
}
