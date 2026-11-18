package com.greenpulse.controller;
import com.greenpulse.common.ApiEnvelope;import com.greenpulse.service.*;import org.springframework.format.annotation.DateTimeFormat;import org.springframework.web.bind.annotation.*;import java.time.LocalDate;
@RestController @RequestMapping("/api/v1/carbon")
public class CarbonController {
 private final ReadingService readings;private final AnalyticsService analytics;
 public CarbonController(ReadingService r,AnalyticsService a){readings=r;analytics=a;}
 @GetMapping("/emissions") public ApiEnvelope<?> emissions(@RequestParam(defaultValue="2000-01-01") @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,@RequestParam(defaultValue="2099-12-31") @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to){return ApiEnvelope.ok("Estimated carbon emissions",analytics.emissions(readings.list(null,from,to)));}
 @GetMapping("/monthly-summary") public ApiEnvelope<?> monthly(){return emissions(LocalDate.now().minusMonths(12).withDayOfMonth(1),LocalDate.now());}
 @GetMapping("/building-comparison") public ApiEnvelope<?> comparison(@RequestParam(defaultValue="2000-01-01") @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,@RequestParam(defaultValue="2099-12-31") @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to){return emissions(from,to);}
}
