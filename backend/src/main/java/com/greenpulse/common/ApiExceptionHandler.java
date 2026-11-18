package com.greenpulse.common;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestControllerAdvice
public class ApiExceptionHandler {
 @ExceptionHandler(NoSuchElementException.class) ResponseEntity<?> missing(RuntimeException e) { return ResponseEntity.status(404).body(ApiEnvelope.fail("Not found", Map.of("error", e.getMessage()))); }
 @ExceptionHandler(IllegalArgumentException.class) ResponseEntity<?> invalid(RuntimeException e) { return ResponseEntity.badRequest().body(ApiEnvelope.fail("Invalid request", Map.of("error", e.getMessage()))); }
 @ExceptionHandler(IllegalStateException.class) ResponseEntity<?> unavailable(RuntimeException e) { return ResponseEntity.status(503).body(ApiEnvelope.fail("Service unavailable", Map.of("error", e.getMessage()))); }
 @ExceptionHandler(DataIntegrityViolationException.class) ResponseEntity<?> duplicate(RuntimeException e) { return ResponseEntity.status(409).body(ApiEnvelope.fail("Conflicting data", Map.of("error", "A record with those values already exists"))); }
 @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<?> validation(MethodArgumentNotValidException e) { var errors = new LinkedHashMap<String,String>(); e.getBindingResult().getFieldErrors().forEach(x -> errors.put(x.getField(), x.getDefaultMessage())); return ResponseEntity.badRequest().body(ApiEnvelope.fail("Validation failed", errors)); }
}
