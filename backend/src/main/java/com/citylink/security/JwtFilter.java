package com.citylink.security;

import com.citylink.repository.StaffRepository;
import com.citylink.repository.UserAccountRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtFilter extends OncePerRequestFilter {

  private final TokenService tokens;
  private final UserAccountRepository users;
  private final StaffRepository staffMembers;

  public JwtFilter(
    TokenService tokens,
    UserAccountRepository users,
    StaffRepository staffMembers
  ) {
    this.tokens = tokens;
    this.users = users;
    this.staffMembers = staffMembers;
  }

  @Override
  protected void doFilterInternal(
    HttpServletRequest req,
    HttpServletResponse res,
    FilterChain chain
  ) throws ServletException, IOException {
    var h = req.getHeader("Authorization");
    if (h != null && h.startsWith("Bearer ")) {
      var c = tokens.verify(h.substring(7));
      if (c != null) try {
        Long id = Long.valueOf(c.getSubject());
        String userType = c.getStringClaim("userType");
        Integer version = c.getIntegerClaim("version");

        if ("STAFF".equals(userType)) {
          var s = staffMembers.findById(id).orElse(null);
          if (
            s != null &&
            s.status.equals("ACTIVE") &&
            (version == null || s.tokenVersion == version)
          ) {
            req.setAttribute("CURRENT_STAFF_USER", s);
            req.setAttribute("CURRENT_USER_TYPE", "STAFF");
            SecurityContextHolder.getContext().setAuthentication(
              new UsernamePasswordAuthenticationToken(
                s.id,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + s.role))
              )
            );
          }
        } else {
          var u = users.findById(id).orElse(null);
          if (
            u != null &&
            u.verified &&
            u.status.equals("ACTIVE") &&
            (version == null || u.tokenVersion == version)
          ) {
            req.setAttribute("CURRENT_PASSENGER_USER", u);
            req.setAttribute("CURRENT_USER_TYPE", "USER");
            SecurityContextHolder.getContext().setAuthentication(
              new UsernamePasswordAuthenticationToken(
                u.id,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + u.role))
              )
            );
          } else if (userType == null) {
            // legacy token fallback
            var s = staffMembers.findById(id).orElse(null);
            if (s != null && s.status.equals("ACTIVE")) {
              req.setAttribute("CURRENT_STAFF_USER", s);
              req.setAttribute("CURRENT_USER_TYPE", "STAFF");
              SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                  s.id,
                  null,
                  List.of(new SimpleGrantedAuthority("ROLE_" + s.role))
                )
              );
            }
          }
        }
      } catch (java.text.ParseException | NumberFormatException ignored) {}
    }
    chain.doFilter(req, res);
  }
}
