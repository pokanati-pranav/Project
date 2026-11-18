package com.greenpulse.domain;
import jakarta.persistence.*;import lombok.*;import java.math.BigDecimal;import java.time.*;
@Entity @Table(name="anomaly_alerts") @Getter @Setter @NoArgsConstructor
public class AnomalyAlert {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="building_id",nullable=false) private Building building;
 @OneToOne(fetch=FetchType.LAZY) @JoinColumn(name="reading_id",nullable=false,unique=true) private EnergyReading reading;
 @Column(name="anomaly_score",nullable=false,precision=9,scale=6) private BigDecimal anomalyScore;
 @Column(nullable=false) private String severity;
 @Column(nullable=false) private String description;
 @Column(nullable=false) private String status="OPEN";
 @Column(name="detected_at",insertable=false,updatable=false) private Instant detectedAt;
 @Column(name="resolved_at") private Instant resolvedAt;
}
