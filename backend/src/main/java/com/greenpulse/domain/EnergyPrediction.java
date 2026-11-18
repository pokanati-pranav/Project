package com.greenpulse.domain;
import jakarta.persistence.*;import lombok.*;import java.math.BigDecimal;import java.time.*;
@Entity @Table(name="energy_predictions") @Getter @Setter @NoArgsConstructor
public class EnergyPrediction {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="building_id",nullable=false) private Building building;
 @Column(name="prediction_date",nullable=false) private LocalDate predictionDate;
 @Column(name="predicted_kwh",nullable=false,precision=14,scale=3) private BigDecimal predictedKwh;
 @Column(name="model_name",nullable=false) private String modelName;
 @Column(name="model_version",nullable=false) private String modelVersion;
 @Column(name="created_at",insertable=false,updatable=false) private Instant createdAt;
}
