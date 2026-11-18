package com.greenpulse.repository;
import com.greenpulse.domain.EnergyReading;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.*;
public interface ReadingRepository extends JpaRepository<EnergyReading,Long> {
 @Query("select r from EnergyReading r join fetch r.building b join fetch b.organization where (:building is null or b.id=:building) and (:all=true or b.organization.id=:org) and r.readingDate between :from and :to order by r.readingDate") List<EnergyReading> range(@Param("building") Long building,@Param("all") boolean all,@Param("org") Long org,@Param("from") LocalDate from,@Param("to") LocalDate to);
 @Query("select r from EnergyReading r join fetch r.building b join fetch b.organization where b.id=:building and (:all=true or b.organization.id=:org) order by r.readingDate") List<EnergyReading> byBuilding(@Param("building") Long building,@Param("all") boolean all,@Param("org") Long org);
}
