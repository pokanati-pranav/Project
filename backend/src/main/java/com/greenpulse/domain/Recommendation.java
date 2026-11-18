package com.greenpulse.domain;
import jakarta.persistence.*;import lombok.*;import java.math.BigDecimal;import java.time.Instant;
@Entity @Table(name="recommendations") @Getter @Setter @NoArgsConstructor
public class Recommendation {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="building_id",nullable=false) private Building building;
 @Column(nullable=false) private String title;
 @Column(nullable=false,columnDefinition="TEXT") private String description;
 @Column(name="recommendation_type",nullable=false) private String recommendationType;
 @Column(nullable=false) private String priority;
 @Column(name="estimated_saving_kwh",precision=14,scale=3) private BigDecimal estimatedSavingKwh;
 @Column(nullable=false) private String status="OPEN";
 @Column(name="created_at",insertable=false,updatable=false) private Instant createdAt;
}
