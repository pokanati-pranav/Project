package com.greenpulse.domain;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.*;
@Entity @Table(name="emission_factors") @Getter @Setter @NoArgsConstructor
public class EmissionFactor {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(nullable=false) private String region;
 @Column(name="emission_factor", nullable=false, precision=12, scale=6) private BigDecimal factor;
 @Column(nullable=false) private String unit;
 @Column(name="effective_from", nullable=false) private LocalDate effectiveFrom;
 @Column(name="effective_to") private LocalDate effectiveTo;
 @Column(nullable=false) private String source;
}
