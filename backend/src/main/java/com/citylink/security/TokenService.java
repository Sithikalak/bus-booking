package com.citylink.security;

import com.citylink.entity.UserAccount;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.*;
import com.nimbusds.jwt.*;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class TokenService {

  private final byte[] key;

  public TokenService(
    @Value("${app.jwt-secret}") String secret,
    @Value("${app.development}") boolean dev
  ) {
    if (secret.isBlank()) {
      if (!dev) throw new IllegalStateException(
        "JWT_SECRET is required outside development"
      );
      key = new byte[32];
      new SecureRandom().nextBytes(key);
    } else {
      key = secret.getBytes(java.nio.charset.StandardCharsets.UTF_8);
      if (key.length < 32) throw new IllegalStateException(
        "JWT_SECRET must be at least 32 bytes"
      );
    }
  }

  public String issue(UserAccount u) {
    try {
      var claims = new JWTClaimsSet.Builder()
        .subject(u.id.toString())
        .issuer("citylink-express")
        .issueTime(new Date())
        .expirationTime(Date.from(Instant.now().plusSeconds(7200)))
        .jwtID(UUID.randomUUID().toString())
        .claim("version", u.tokenVersion)
        .claim("userType", "USER")
        .claim("role", u.role)
        .build();
      var jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
      jwt.sign(new MACSigner(key));
      return jwt.serialize();
    } catch (Exception e) {
      throw new IllegalStateException("Could not create session", e);
    }
  }

  public String issueStaff(com.citylink.entity.Staff s) {
    try {
      var claims = new JWTClaimsSet.Builder()
        .subject(s.id.toString())
        .issuer("citylink-express")
        .issueTime(new Date())
        .expirationTime(Date.from(Instant.now().plusSeconds(7200)))
        .jwtID(UUID.randomUUID().toString())
        .claim("version", s.tokenVersion)
        .claim("userType", "STAFF")
        .claim("role", s.role)
        .build();
      var jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
      jwt.sign(new MACSigner(key));
      return jwt.serialize();
    } catch (Exception e) {
      throw new IllegalStateException("Could not create session", e);
    }
  }

  public JWTClaimsSet verify(String token) {
    try {
      var jwt = SignedJWT.parse(token);
      if (
        !JWSAlgorithm.HS256.equals(jwt.getHeader().getAlgorithm()) ||
        !jwt.verify(new MACVerifier(key))
      ) return null;
      var c = jwt.getJWTClaimsSet();
      if (
        !"citylink-express".equals(c.getIssuer()) ||
        c.getExpirationTime() == null ||
        c.getExpirationTime().before(new Date())
      ) return null;
      return c;
    } catch (Exception e) {
      return null;
    }
  }
}
