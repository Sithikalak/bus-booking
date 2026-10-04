package com.citylink;

import static org.assertj.core.api.Assertions.*;

import com.citylink.exception.BusinessException;
import com.citylink.security.Permissions;
import com.citylink.service.MockPaymentGateway;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class PermissionsTest {

  @Test
  void passengerCannotAcquireAdministrativePermissions() {
    assertThatThrownBy(() ->
      Permissions.validate("PASSENGER", List.of("USERS"))
    ).isInstanceOf(BusinessException.class);
  }

  @Test
  void unsupportedRolesAreRejected() {
    assertThatThrownBy(() ->
      Permissions.validate("ROOT", List.of())
    ).isInstanceOf(BusinessException.class);
  }

  @Test
  void operatorCanHavePermissionsRemovedButCannotManageUsers() {
    assertThat(
      Permissions.validate("OPERATOR", List.of("SCHEDULES"))
    ).isEqualTo("SCHEDULES");
    assertThatThrownBy(() ->
      Permissions.validate("OPERATOR", List.of("USERS"))
    ).isInstanceOf(BusinessException.class);
  }

  @Test
  void paymentSimulationIsDeterministicAndSupportsFailure() {
    var gateway = new MockPaymentGateway();
    assertThat(
      gateway.charge("mock_success", BigDecimal.TEN, "retry-key").reference()
    ).isEqualTo(
      gateway.charge("mock_success", BigDecimal.TEN, "retry-key").reference()
    );
    assertThat(
      gateway.charge("mock_decline", BigDecimal.TEN, "decline-key").success()
    ).isFalse();
    assertThat(
      gateway.refund("original", BigDecimal.TEN, "refund-key", true).success()
    ).isFalse();
  }
}
