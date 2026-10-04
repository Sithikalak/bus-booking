package com.citylink.service;

import static com.citylink.util.Values.*;

import com.citylink.dto.Requests.*;
import com.citylink.entity.*;
import com.citylink.exception.BusinessException;
import com.citylink.mapper.Views;
import com.citylink.repository.*;
import com.citylink.security.*;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

  private final UserAccountRepository users;
  private final ChallengeRepository challenges;
  private final StaffProfileRepository staff;
  private final StaffRepository staffMembers;
  private final BCryptPasswordEncoder encoder;
  private final TokenService tokens;
  private final CurrentUser current;
  private final VerificationProvider delivery;
  private final NotificationService notes;
  private final boolean dev;
  private final SecureRandom random = new SecureRandom();
  private final ConcurrentHashMap<String, Deque<Instant>> limits =
    new ConcurrentHashMap<>();

  public AuthService(
    UserAccountRepository users,
    ChallengeRepository challenges,
    StaffProfileRepository staff,
    StaffRepository staffMembers,
    BCryptPasswordEncoder encoder,
    TokenService tokens,
    CurrentUser current,
    VerificationProvider delivery,
    NotificationService notes,
    @Value("${app.development}") boolean dev
  ) {
    this.users = users;
    this.challenges = challenges;
    this.staff = staff;
    this.staffMembers = staffMembers;
    this.encoder = encoder;
    this.tokens = tokens;
    this.current = current;
    this.delivery = delivery;
    this.notes = notes;
    this.dev = dev;
  }

  private void rate(String key, int max) {
    var q = limits.computeIfAbsent(key, k -> new ArrayDeque<>());
    synchronized (q) {
      while (
          !q.isEmpty() &&
          q.peekFirst().isBefore(Instant.now().minusSeconds(900))
        )
        q.removeFirst();
      if (q.size() >= max) throw new BusinessException(
        "RATE_LIMITED",
        "Too many attempts. Please wait 15 minutes.",
        429
      );
      q.addLast(Instant.now());
    }
    if (limits.size() > 10000) limits
      .entrySet()
      .removeIf(e -> e.getValue().isEmpty());
  }

  private String email(String value) {
    return value.strip().toLowerCase(Locale.ROOT);
  }

  private void password(String value) {
    check(
      value != null &&
        value.length() >= 10 &&
        value.getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 72 &&
        value.matches(".*[A-Za-z].*") &&
        value.matches(".*[0-9].*"),
      "WEAK_PASSWORD",
      "Use 10–72 bytes with letters and a number."
    );
  }

  private Object issue(Challenge c) {
    String code = String.format("%06d", random.nextInt(1000000));
    c.codeHash = encoder.encode(code);
    c.expiresAt = Instant.now().plusSeconds(600);
    c.resendAfter = Instant.now().plusSeconds(30);
    c.attempts = 0;
    challenges.save(c);
    delivery.deliver(c.email, code, c.purpose);
    return map(
      "challengeId",
      c.publicId,
      "devCode",
      dev ? code : null,
      "expiresAt",
      c.expiresAt,
      "message",
      "Verification sent. In development, the code appears here instead of email."
    );
  }

  @Transactional
  public Object register(Register r) {
    rate("register:" + email(r.email()), 5);
    password(r.password());
    oneOf(r.role(), "PASSENGER", "DRIVER", "CONDUCTOR", "OPERATOR");
    check(
      users.findByEmailIgnoreCase(email(r.email())).isEmpty(),
      "EMAIL_EXISTS",
      "An account already uses this email."
    );
    var c = new Challenge();
    c.publicId = UUID.randomUUID().toString();
    c.email = email(r.email());
    c.purpose = "REGISTER";
    c.firstName = r.firstName().strip();
    c.lastName = r.lastName().strip();
    c.phone = r.phone();
    c.passwordHash = encoder.encode(r.password());
    c.role = r.role();
    return issue(c);
  }

  private Challenge locked(String publicId) {
    var found = required(
      challenges.findByPublicId(publicId),
      "Verification request"
    );
    return required(challenges.lockById(found.id), "Verification request");
  }

  private void verifyCode(Challenge c, String code) {
    check(
      !c.used,
      "CODE_USED",
      "This verification request has already been used."
    );
    check(
      c.expiresAt.isAfter(Instant.now()),
      "CODE_EXPIRED",
      "The code expired. Request a new code."
    );
    check(
      c.attempts < 5,
      "CODE_LOCKED",
      "Too many incorrect codes. Request a new code."
    );
    c.attempts++;
    check(
      encoder.matches(code, c.codeHash),
      "INVALID_CODE",
      "The verification code is incorrect."
    );
  }

  @Transactional(noRollbackFor = BusinessException.class)
  public Object verify(Verify r) {
    var c = locked(r.challengeId());
    check(
      c.purpose.equals("REGISTER"),
      "INVALID_CHALLENGE",
      "Use the password recovery form for this code."
    );
    verifyCode(c, r.code());
    check(
      users.findByEmailIgnoreCase(c.email).isEmpty(),
      "EMAIL_EXISTS",
      "An account already uses this email."
    );
    var u = new UserAccount();
    u.firstName = c.firstName;
    u.lastName = c.lastName;
    u.email = c.email;
    u.phone = c.phone;
    u.passwordHash = c.passwordHash;
    u.role = c.role;
    u.status = c.role.equals("PASSENGER") ? "ACTIVE" : "PENDING_APPROVAL";
    u.verified = true;
    u.permissions = Permissions.validate(u.role, null);
    users.save(u);
    c.used = true;
    c.passwordHash = null;
    if (Set.of("DRIVER", "CONDUCTOR").contains(u.role)) {
      var s = new StaffProfile();
      s.user = u;
      staff.save(s);
    }
    notes.send(
      u,
      "ACCOUNT",
      "Welcome to CityLink",
      u.status.equals("ACTIVE")
        ? "Your account is ready. Your next journey starts here."
        : "Your identity is verified. An administrator must activate your staff account."
    );
    if (!u.status.equals("ACTIVE")) notes.role(
      "ADMIN",
      "ACCOUNT",
      "Staff account awaiting approval",
      u.email + " requested " + u.role + " access."
    );
    return map(
      "token",
      u.status.equals("ACTIVE") ? tokens.issue(u) : null,
      "user",
      Views.user(u),
      "pendingApproval",
      !u.status.equals("ACTIVE")
    );
  }

  @Transactional
  public Object resend(ChallengeId r) {
    var c = locked(r.challengeId());
    rate("resend:" + c.email, 6);
    check(
      !c.used,
      "CODE_USED",
      "This verification request has already been used."
    );
    check(
      !c.resendAfter.isAfter(Instant.now()),
      "RESEND_WAIT",
      "Wait 30 seconds before requesting another code."
    );
    return issue(c);
  }

  @Transactional(readOnly = true)
  public Object login(Login r) {
    String cleanEmail = email(r.email());
    rate("login:" + cleanEmail, 15);

    // 1. Check users (passengers)
    var u = users.findByEmailIgnoreCase(cleanEmail).orElse(null);
    if (u != null) {
      if (!encoder.matches(r.password(), u.passwordHash)) {
        throw new BusinessException(
          "INVALID_CREDENTIALS",
          "Email or password is incorrect.",
          401
        );
      }
      check(u.verified, "UNVERIFIED", "Verify your account before signing in.");
      check(
        u.status.equals("ACTIVE"),
        "ACCOUNT_INACTIVE",
        "Your account is disabled or awaiting staff approval."
      );
      return map("token", tokens.issue(u), "user", Views.user(u));
    }

    // 2. Check staff (admins, operators, drivers, conductors, customer service)
    var s = staffMembers.findByEmailIgnoreCase(cleanEmail).orElse(null);
    if (s != null) {
      if (!encoder.matches(r.password(), s.passwordHash)) {
        throw new BusinessException(
          "INVALID_CREDENTIALS",
          "Email or password is incorrect.",
          401
        );
      }
      check(
        s.status.equals("ACTIVE"),
        "ACCOUNT_INACTIVE",
        "Your staff account is disabled."
      );
      return map("token", tokens.issueStaff(s), "user", Views.staff(s));
    }

    throw new BusinessException(
      "INVALID_CREDENTIALS",
      "Email or password is incorrect.",
      401
    );
  }

  @Transactional
  public Object recover(Recover r) {
    String cleanEmail = email(r.email());
    rate("recover:" + cleanEmail, 5);
    var c = new Challenge();
    c.publicId = UUID.randomUUID().toString();
    c.email = cleanEmail;
    c.purpose = "RESET";
    if (users.findByEmailIgnoreCase(cleanEmail).isPresent() || staffMembers.findByEmailIgnoreCase(cleanEmail).isPresent()) {
      return issue(c);
    }
    return map(
      "challengeId",
      c.publicId,
      "devCode",
      null,
      "message",
      "If an account exists, a verification code has been sent."
    );
  }

  @Transactional(noRollbackFor = BusinessException.class)
  public Object reset(Reset r) {
    password(r.password());
    var c = locked(r.challengeId());
    check(
      c.purpose.equals("RESET"),
      "INVALID_CHALLENGE",
      "This code is for registration."
    );
    verifyCode(c, r.code());
    var userOpt = users.findByEmailIgnoreCase(c.email);
    if (userOpt.isPresent()) {
      var u = userOpt.get();
      u.passwordHash = encoder.encode(r.password());
      u.tokenVersion++;
      u.updatedAt = Instant.now();
      c.used = true;
      notes.send(
        u,
        "ACCOUNT",
        "Password updated",
        "Your password was reset. All previous sessions have ended."
      );
      return map("message", "Password updated. Please sign in.");
    }

    var staffOpt = staffMembers.findByEmailIgnoreCase(c.email);
    if (staffOpt.isPresent()) {
      var s = staffOpt.get();
      s.passwordHash = encoder.encode(r.password());
      s.tokenVersion++;
      s.updatedAt = Instant.now();
      c.used = true;
      return map("message", "Password updated. Please sign in.");
    }

    throw new BusinessException("NOT_FOUND", "Account not found.", 404);
  }

  @Transactional
  public Object logout() {
    Long id = current.get().id;
    var staffOpt = staffMembers.lockById(id);
    if (staffOpt.isPresent()) {
      staffOpt.get().tokenVersion++;
      return map("message", "Signed out on all devices.");
    }
    var userOpt = users.lockById(id);
    if (userOpt.isPresent()) {
      userOpt.get().tokenVersion++;
    }
    return map("message", "Signed out on all devices.");
  }

  public Object me() {
    var staff = current.staffMember();
    if (staff.isPresent()) {
      return Views.staff(staff.get());
    }
    return Views.user(current.get());
  }
}
