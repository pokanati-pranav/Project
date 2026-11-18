package com.greenpulse.repository;
import com.greenpulse.domain.EmissionFactor;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.*;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
public interface FactorRepository extends JpaRepository<EmissionFactor,Long> {
 Optional<EmissionFactor> findFirstByRegionAndEffectiveFromLessThanEqualAndEffectiveToIsNullOrderByEffectiveFromDesc(String region,LocalDate date);
 @Query("select f from EmissionFactor f where f.region=:region and f.effectiveFrom<=:date and (f.effectiveTo is null or f.effectiveTo>=:date) order by f.effectiveFrom desc") List<EmissionFactor> effective(@Param("region") String region,@Param("date") LocalDate date);
 List<EmissionFactor> findAllByOrderByEffectiveFromDesc();
}
