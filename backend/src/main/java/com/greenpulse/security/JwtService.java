package com.greenpulse.security;
import com.greenpulse.domain.AppUser;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.*;
@Service
public class JwtService {
 private final SecretKey key; private final long expiration;
 public JwtService(@Value("${greenpulse.jwt-secret}") String secret,@Value("${greenpulse.jwt-expiration-ms}") long expiration){this.key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));this.expiration=expiration;}
 public String create(AppUser u){return Jwts.builder().subject(u.getEmail()).claim("role",u.getRole().name()).claim("org",u.getOrganization()==null?null:u.getOrganization().getId()).issuedAt(new Date()).expiration(new Date(System.currentTimeMillis()+expiration)).signWith(key).compact();}
 public String subject(String token){return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload().getSubject();}
}
