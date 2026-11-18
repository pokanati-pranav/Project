package com.greenpulse.repository;
import com.greenpulse.domain.AnomalyAlert;import org.springframework.data.jpa.repository.*;import org.springframework.data.repository.query.Param;import java.util.*;
public interface AnomalyRepository extends JpaRepository<AnomalyAlert,Long>{ boolean existsByReadingId(Long readingId);
 @Query("select a from AnomalyAlert a join fetch a.building b join fetch a.reading where (:all=true or b.organization.id=:org) order by a.detectedAt desc") List<AnomalyAlert> scoped(@Param("all") boolean all,@Param("org") Long org);
 @Query("select a from AnomalyAlert a join fetch a.building b join fetch a.reading where a.id=:id and (:all=true or b.organization.id=:org)") Optional<AnomalyAlert> findScoped(@Param("id") Long id,@Param("all") boolean all,@Param("org") Long org);
}
