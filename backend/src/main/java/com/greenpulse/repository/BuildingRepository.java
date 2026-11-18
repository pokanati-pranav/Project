package com.greenpulse.repository;
import com.greenpulse.domain.Building;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface BuildingRepository extends JpaRepository<Building,Long> {
 @Query("select b from Building b where (:all = true or b.organization.id = :org) order by b.name") List<Building> scoped(@Param("all") boolean all,@Param("org") Long org);
 @Query("select b from Building b where b.id=:id and (:all=true or b.organization.id=:org)") Optional<Building> findScoped(@Param("id") Long id,@Param("all") boolean all,@Param("org") Long org);
}
