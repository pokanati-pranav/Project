package com.greenpulse.repository;
import com.greenpulse.domain.Recommendation;import org.springframework.data.jpa.repository.*;import org.springframework.data.repository.query.Param;import java.util.*;
public interface RecommendationRepository extends JpaRepository<Recommendation,Long>{
 @Query("select r from Recommendation r join fetch r.building b where (:all=true or b.organization.id=:org) order by r.createdAt desc") List<Recommendation> scoped(@Param("all") boolean all,@Param("org") Long org);
 boolean existsByBuildingIdAndTitleAndStatus(Long buildingId,String title,String status);
}
