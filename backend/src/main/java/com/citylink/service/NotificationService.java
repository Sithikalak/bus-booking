package com.citylink.service;

import static com.citylink.util.Values.*;

import com.citylink.entity.*;
import com.citylink.mapper.Views;
import com.citylink.repository.*;
import com.citylink.security.CurrentUser;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class NotificationService {

  private final NotificationRepository notes;
  private final UserAccountRepository users;
  private final CurrentUser current;

  public NotificationService(
    NotificationRepository notes,
    UserAccountRepository users,
    CurrentUser current
  ) {
    this.notes = notes;
    this.users = users;
    this.current = current;
  }

  public void send(
    UserAccount user,
    String type,
    String title,
    String message
  ) {
    var n = new Notification();
    n.recipient = user;
    n.type = type;
    n.title = title;
    n.message = message;
    notes.save(n);
  }

  public void role(String role, String type, String title, String message) {
    users.findByRole(role).forEach(u -> send(u, type, title, message));
  }

  @Transactional(readOnly = true)
  public Object list(int page, int size) {
    return list(page, size, null, false);
  }

  @Transactional(readOnly = true)
  public Object list(int page, int size, String roleFilter, Boolean allRoles) {
    var u = current.get();
    if (u == null) {
      return page(List.of(), page, size);
    }

    List<Notification> list;
    if ("ADMIN".equalsIgnoreCase(u.role) && Boolean.TRUE.equals(allRoles)) {
      if (roleFilter != null && !roleFilter.isBlank() && !"ALL".equalsIgnoreCase(roleFilter)) {
        list = notes.findAll(Sort.by(Sort.Direction.DESC, "id")).stream()
          .filter(n -> n.recipient != null && roleFilter.equalsIgnoreCase(n.recipient.role))
          .toList();
      } else {
        list = notes.findAll(Sort.by(Sort.Direction.DESC, "id"));
      }
    } else {
      // By default: ONLY return notifications relevant to this specific user & role!
      list = notes.findRelevantForUser(u.id, u.role);
    }

    return page(
      list.stream()
        .map(Views::notification)
        .toList(),
      page,
      size
    );
  }

  @Transactional
  public Object read(Long id, boolean value) {
    var n = required(notes.findById(id), "Notification");
    var u = current.get();
    if (u != null && (u.role.equalsIgnoreCase("ADMIN") || (n.recipient != null && (n.recipient.id.equals(u.id) || n.recipient.role.equalsIgnoreCase(u.role))))) {
      n.isRead = value;
    }
    return Views.notification(n);
  }

  @Transactional
  public Object readAll() {
    var u = current.get();
    if (u != null) {
      var userNotes = notes.findRelevantForUser(u.id, u.role);
      for (var n : userNotes) {
        n.isRead = true;
      }
    }
    return map("status", "OK");
  }
}
