package com.greenpulse.domain;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
@Entity @Table(name="organizations") @Getter @Setter @NoArgsConstructor
public class Organization {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="organization_name", nullable=false) private String name;
 @Column(name="organization_type") private String type;
 private String address; private String country; private String state;
 @Column(name="created_at", insertable=false, updatable=false) private Instant createdAt;
}
