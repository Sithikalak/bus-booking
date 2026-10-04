package com.citylink.security;

import static com.citylink.util.Values.*;

import com.citylink.entity.Staff;
import com.citylink.entity.UserAccount;
import com.citylink.exception.BusinessException;
import com.citylink.repository.StaffRepository;
import com.citylink.repository.UserAccountRepository;
import java.util.Optional;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component("access")
public class CurrentUser {

  private final UserAccountRepository users;
  private final StaffRepository staffMembers;

  public CurrentUser(
    UserAccountRepository users,
    StaffRepository staffMembers
  ) {
    this.users = users;
    this.staffMembers = staffMembers;
  }

  public UserAccount get() {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (
      auth == null || !(auth.getPrincipal() instanceof Long id)
    ) throw new BusinessException("UNAUTHORIZED", "Please sign in.", 401);

    var u = users.findById(id).orElse(null);
    if (u != null) return u;

    var s = staffMembers.findById(id).orElse(null);
    if (s != null) {
      var su = new UserAccount();
      su.id = s.id;
      su.firstName = s.firstName;
      su.lastName = s.lastName;
      su.email = s.email;
      su.phone = s.phone;
      su.role = s.role;
      su.status = s.status;
      su.verified = true;
      su.permissions = s.permissions;
      su.tokenVersion = s.tokenVersion;
      su.createdAt = s.createdAt;
      su.updatedAt = s.updatedAt;
      return su;
    }
    throw new BusinessException("NOT_FOUND", "Account not found.", 404);
  }

  public Optional<Staff> staffMember() {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !(auth.getPrincipal() instanceof Long id)) return Optional.empty();
    return staffMembers.findById(id);
  }

  public boolean has(String permission) {
    var u = get();
    return (
      u.role.equals("ADMIN") ||
      java.util.Arrays.asList(u.permissions.split(",")).contains(permission)
    );
  }

  public boolean role(String role) {
    return get().role.equals(role);
  }

  public boolean staff() {
    return !get().role.equals("PASSENGER");
  }

  public void require(String permission) {
    if (!has(permission)) throw new BusinessException(
      "FORBIDDEN",
      "You do not have permission for this action.",
      403
    );
  }

  public void owner(Long id) {
    if (!get().id.equals(id)) throw new BusinessException(
      "FORBIDDEN",
      "This record belongs to another account.",
      403
    );
  }
}
