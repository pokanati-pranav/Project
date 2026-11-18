package com.greenpulse.domain;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
@Entity @Table(name="users") @Getter @Setter @NoArgsConstructor
public class AppUser {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(nullable=false) private String name;
 @Column(nullable=false, unique=true) private String email;
 @Column(nullable=false) private String password;
 @Enumerated(EnumType.STRING) @Column(nullable=false) private Role role;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="organization_id") private Organization organization;
 @Column(nullable=false) private boolean enabled=true;
 @Column(name="created_at", insertable=false, updatable=false) private Instant createdAt;
}
