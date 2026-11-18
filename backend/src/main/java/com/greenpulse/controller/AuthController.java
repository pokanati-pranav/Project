package com.greenpulse.controller;
import com.greenpulse.common.ApiEnvelope;import com.greenpulse.service.*;import jakarta.validation.Valid;import jakarta.validation.constraints.*;import org.springframework.web.bind.annotation.*;import java.util.*;
@RestController @RequestMapping("/api/v1/auth")
public class AuthController {
 private final AuthService auth;private final CurrentUser current;
 public AuthController(AuthService auth,CurrentUser current){this.auth=auth;this.current=current;}
 record Login(@Email @NotBlank String email,@NotBlank String password){} record Register(@NotBlank String name,@Email String email,@Size(min=12) String password,@NotBlank String role,Long organizationId){}
 @PostMapping("/login") public ApiEnvelope<?> login(@Valid @RequestBody Login x){return ApiEnvelope.ok("Signed in",auth.login(x.email(),x.password()));}
 @PostMapping("/register") public ApiEnvelope<?> register(@Valid @RequestBody Register x){return ApiEnvelope.ok("Account created",auth.register(x.name(),x.email(),x.password(),x.role(),x.organizationId()));}
 @GetMapping("/me") public ApiEnvelope<?> me(){return ApiEnvelope.ok("Current user",auth.profile(current.get()));}
 @PostMapping("/refresh") public ApiEnvelope<?> refresh(){return ApiEnvelope.ok("Token refreshed",auth.refresh(current.get()));}
}
