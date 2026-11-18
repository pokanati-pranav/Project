package com.greenpulse.service;
import com.greenpulse.domain.AppUser;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import com.greenpulse.repository.UserRepository;
@Component
public class CurrentUser {
 private final UserRepository users;
 public CurrentUser(UserRepository users){this.users=users;}
 public AppUser get(){String email=SecurityContextHolder.getContext().getAuthentication().getName();return users.findByEmail(email).orElseThrow();}
 public boolean isSuper(AppUser u){return u.getRole().name().equals("SUPER_ADMIN");}
 public Long org(AppUser u){return u.getOrganization()==null?null:u.getOrganization().getId();}
}
