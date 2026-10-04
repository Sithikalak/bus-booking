package com.citylink.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = "app.development", havingValue = "true")
public class DevelopmentVerificationProvider implements VerificationProvider {

  public void deliver(String email, String code, String purpose) {
    /* Development delivery is returned only to the initiating browser by AuthService. Replace this adapter with email/SMS in production. */
  }
}
