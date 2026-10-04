package com.citylink.service;

public interface VerificationProvider {
  void deliver(String email, String code, String purpose);
}
