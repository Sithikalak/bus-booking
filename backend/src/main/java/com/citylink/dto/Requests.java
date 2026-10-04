package com.citylink.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class Requests {

  public record Login(
    @NotBlank @Email String email,
    @NotBlank String password
  ) {}

  public record Register(
    @NotBlank @Size(max = 80) String firstName,
    @NotBlank @Size(max = 80) String lastName,
    @Email @NotBlank @Size(max = 190) String email,
    @Pattern(regexp = "[+0-9 ()-]{8,24}") @NotBlank String phone,
    @Size(min = 10, max = 72) @NotBlank String password,
    @NotBlank String role
  ) {}

  public record Verify(
    @NotBlank String challengeId,
    @Pattern(regexp = "[0-9]{6}") @NotBlank String code
  ) {}

  public record ChallengeId(@NotBlank String challengeId) {}

  public record Recover(@Email @NotBlank String email) {}

  public record Reset(
    @NotBlank String challengeId,
    @NotBlank String code,
    @Size(min = 10, max = 72) @NotBlank String password
  ) {}

  public record Profile(
    @NotBlank @Size(max = 80) String firstName,
    @NotBlank @Size(max = 80) String lastName,
    @NotBlank @Pattern(regexp = "[+0-9 ()-]{8,24}") String phone,
    @Email @Size(max = 190) String email,
    String password
  ) {}

  public record UserInput(
    @NotBlank @Size(max = 80) String firstName,
    @NotBlank @Size(max = 80) String lastName,
    @Email @NotBlank @Size(max = 190) String email,
    @NotBlank @Pattern(regexp = "[+0-9 ()-]{8,24}") String phone,
    String password,
    @NotBlank String role,
    @NotBlank String status,
    boolean verified,
    List<String> permissions
  ) {}

  public record BusInput(
    @NotBlank @Size(max = 40) String registration,
    @NotBlank @Size(max = 120) String model,
    @Min(8) @Max(60) int capacity,
    @NotBlank @Size(max = 60) String type,
    @NotNull @Size(max = 500) String features,
    @NotBlank String status
  ) {}

  public record StopInput(
    @NotBlank @Size(max = 120) String name,
    @DecimalMin("-90") @DecimalMax("90") double latitude,
    @DecimalMin("-180") @DecimalMax("180") double longitude,
    @Min(0) @Max(1440) int minutesFromDeparture
  ) {}

  public record RouteInput(
    @NotBlank @Size(max = 150) String name,
    @NotBlank @Size(max = 80) String origin,
    @NotBlank @Size(max = 80) String destination,
    @DecimalMin("1") double distanceKm,
    boolean active,
    String imageUrl,
    @Valid @NotNull @Size(min = 2, max = 50) List<StopInput> stops
  ) {}

  public record ScheduleInput(
    @NotNull Long routeId,
    Long busId,
    Long driverId,
    Long conductorId,
    @NotNull LocalDateTime departure,
    @NotNull LocalDateTime arrival,
    @NotNull @DecimalMin("1") @DecimalMax("1000000") BigDecimal fare,
    @NotBlank String status,
    boolean confirmChanges
  ) {}

  public record Confirm(boolean confirmChanges) {}

  public record Hold(Long seatId, List<Long> seatIds) {}

  public record Checkout(
    String holdToken,
    List<String> holdTokens,
    @NotBlank @Size(max = 160) String passengerName,
    @NotBlank @Pattern(regexp = "[+0-9 ()-]{8,24}") String passengerPhone,
    @NotBlank String method,
    @NotBlank String paymentToken,
    @NotBlank @Size(max = 80) String idempotencyKey,
    String pickupStop,
    String dropoffStop,
    BigDecimal fare
  ) {}

  public record BookingStops(
    @Size(max = 120) String pickupStop,
    @Size(max = 120) String dropoffStop
  ) {}

  public record TrackingInput(
    @NotBlank String status,
    @Min(0) @Max(720) int delayMinutes,
    boolean gpsAvailable
  ) {}

  public record StaffInput(
    @Size(max = 60) String licenseNumber,
    boolean available
  ) {}

  public record IncidentInput(
    @NotNull Long busId,
    @NotBlank @Size(max = 60) String type,
    @NotBlank @Size(max = 2000) String description,
    @NotBlank String priority
  ) {}

  public record IncidentUpdate(@NotBlank String status) {}

  public record SupportInput(
    @NotBlank String category,
    @NotBlank @Size(max = 160) String subject,
    @NotBlank @Size(max = 2000) String description
  ) {}

  public record SupportUpdate(
    @NotBlank String status,
    @NotBlank @Size(max = 2000) String response
  ) {}

  public record RefundInput(
    @NotNull Long bookingId,
    @NotBlank @Size(max = 2000) String reason
  ) {}

  public record RefundReview(
    boolean approve,
    @Size(max = 2000) String reason
  ) {}

  public record Read(boolean read) {}

  public record BoardingUpdate(@NotBlank String status) {}

  public record OnboardTicket(
    @NotNull Long seatId,
    String passengerName,
    String passengerPhone
  ) {}
}
