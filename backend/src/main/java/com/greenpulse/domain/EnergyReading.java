package com.greenpulse.domain;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.*;
@Entity @Table(name="energy_readings") @Getter @Setter @NoArgsConstructor
public class EnergyReading {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="building_id", nullable=false) private Building building;
 @Column(name="reading_date", nullable=false) private LocalDate readingDate;
 @Column(name="energy_consumed_kwh", nullable=false, precision=14, scale=3) private BigDecimal energyConsumedKwh;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="recorded_by", nullable=false) private AppUser recordedBy;
 @Column(nullable=false) private String source="MANUAL";
 @Column(name="created_at", insertable=false, updatable=false) private Instant createdAt;
}
