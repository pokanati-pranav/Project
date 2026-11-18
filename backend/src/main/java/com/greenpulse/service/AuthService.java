package com.greenpulse.service;
import com.greenpulse.domain.*;
import com.greenpulse.repository.*;
import com.greenpulse.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.*;
@Service
public class AuthService {
 private final UserRepository users; private final OrganizationRepository orgs; private final PasswordEncoder encoder; private final JwtService jwt; private final boolean registration;
 public AuthService(UserRepository users,OrganizationRepository orgs,PasswordEncoder encoder,JwtService jwt,@Value("${greenpulse.allow-registration}") boolean registration){this.users=users;this.orgs=orgs;this.encoder=encoder;this.jwt=jwt;this.registration=registration;}
 public Map<String,Object> login(String email,String password){var u=users.findByEmail(email.toLowerCase()).orElseThrow(()->new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED,"Invalid email or password"));if(!u.isEnabled()||!encoder.matches(password,u.getPassword()))throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED,"Invalid email or password");return token(u);}
 public Map<String,Object> register(String name,String email,String password,String role,Long orgId){if(!registration)throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN,"Registration is disabled");if(users.findByEmail(email.toLowerCase()).isPresent())throw new IllegalArgumentException("Email is already registered");AppUser u=new AppUser();u.setName(name);u.setEmail(email.toLowerCase());u.setPassword(encoder.encode(password));u.setRole(Role.valueOf(role));if(orgId!=null)u.setOrganization(orgs.findById(orgId).orElseThrow(()->new NoSuchElementException("Organization not found")));u=users.save(u);return token(u);}
 private Map<String,Object> token(AppUser u){return Map.of("token",jwt.create(u),"user",profile(u));}
 public Map<String,Object> refresh(AppUser u){return token(u);}
 public Map<String,Object> profile(AppUser u){return Map.of("id",u.getId(),"name",u.getName(),"email",u.getEmail(),"role",u.getRole().name(),"organizationId",u.getOrganization()==null?0:u.getOrganization().getId());}
}
