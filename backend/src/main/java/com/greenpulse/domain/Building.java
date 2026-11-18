package com.greenpulse.domain;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
@Entity @Table(name="buildings") @Getter @Setter @NoArgsConstructor
public class Building {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="organization_id", nullable=false) private Organization organization;
 @Column(name="building_name", nullable=false) private String name;
 @Column(name="building_type") private String type;
 private String location;
 @Column(name="area_in_sqft") private BigDecimal areaSqft;
 @Column(name="number_of_floors") private Integer floors;
 @Column(name="created_at", insertable=false, updatable=false) private Instant createdAt;
}
