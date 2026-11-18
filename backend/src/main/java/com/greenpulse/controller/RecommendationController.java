package com.greenpulse.controller;
import com.greenpulse.common.ApiEnvelope;import com.greenpulse.service.RecommendationService;import org.springframework.web.bind.annotation.*;import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
@RestController @RequestMapping("/api/v1/recommendations")
public class RecommendationController {
 private final RecommendationService service;public RecommendationController(RecommendationService service){this.service=service;}
 @GetMapping public ApiEnvelope<?> list(){return ApiEnvelope.ok("Recommendations",service.list().stream().map(r->Map.of("id",r.getId(),"buildingId",r.getBuilding().getId(),"buildingName",r.getBuilding().getName(),"title",r.getTitle(),"description",r.getDescription(),"type",r.getRecommendationType(),"priority",r.getPriority(),"estimatedSavingKwh",r.getEstimatedSavingKwh()==null?0:r.getEstimatedSavingKwh(),"status",r.getStatus())).toList());}
 @PostMapping("/generate/{buildingId}") @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORG_ADMIN','BUILDING_MANAGER')") public ApiEnvelope<?> generate(@PathVariable Long buildingId){return ApiEnvelope.ok("Recommendation rule evaluation complete",service.generate(buildingId));}
 @PutMapping("/{id}/status") @PreAuthorize("hasAnyRole('SUPER_ADMIN','ORG_ADMIN','BUILDING_MANAGER')") public ApiEnvelope<?> status(@PathVariable Long id,@RequestBody Map<String,String> body){var r=service.status(id,body.getOrDefault("status",""));return ApiEnvelope.ok("Recommendation status updated",Map.of("id",r.getId(),"status",r.getStatus()));}
}
