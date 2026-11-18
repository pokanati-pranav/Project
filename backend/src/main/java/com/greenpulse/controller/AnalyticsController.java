package com.greenpulse.controller;
import com.greenpulse.common.ApiEnvelope;import com.greenpulse.service.AnalyticsService;import org.springframework.format.annotation.DateTimeFormat;import org.springframework.web.bind.annotation.*;import java.time.LocalDate;
@RestController @RequestMapping("/api/v1/analytics")
public class AnalyticsController {
 private final AnalyticsService analytics;public AnalyticsController(AnalyticsService a){analytics=a;}
 @GetMapping("/dashboard") public ApiEnvelope<?> dashboard(){return ApiEnvelope.ok("Dashboard analytics",analytics.dashboard());}
 @GetMapping("/consumption-trends") public ApiEnvelope<?> trend(@RequestParam(defaultValue="2000-01-01") @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,@RequestParam(defaultValue="2099-12-31") @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,@RequestParam(required=false) Long buildingId){return ApiEnvelope.ok("Consumption trend",analytics.trend(from,to,buildingId));}
 @GetMapping("/building-comparison") public ApiEnvelope<?> comparison(@RequestParam(defaultValue="2000-01-01") @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,@RequestParam(defaultValue="2099-12-31") @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to){return ApiEnvelope.ok("Building comparison",analytics.comparison(from,to));}
 @GetMapping("/monthly-summary") public ApiEnvelope<?> monthly(){return ApiEnvelope.ok("Monthly summary",analytics.trend(LocalDate.now().minusMonths(12).withDayOfMonth(1),LocalDate.now(),null));}
 @GetMapping("/energy-distribution") public ApiEnvelope<?> distribution(){return ApiEnvelope.ok("Energy distribution",analytics.comparison(LocalDate.now().minusDays(30),LocalDate.now()));}
}
