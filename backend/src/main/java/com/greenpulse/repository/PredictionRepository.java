package com.greenpulse.repository;
import com.greenpulse.domain.EnergyPrediction;import org.springframework.data.jpa.repository.JpaRepository;import java.util.*;
public interface PredictionRepository extends JpaRepository<EnergyPrediction,Long>{List<EnergyPrediction> findByBuildingIdOrderByPredictionDateAsc(Long buildingId);}
