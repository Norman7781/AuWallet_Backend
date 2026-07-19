package com.auwallet.academic.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Mirrors academic.program. The Wallet service only ever READS this table;
 * nothing in this codebase should issue an INSERT/UPDATE/DELETE against the
 * academic schema. That schema is owned by the (synthetic) VMES system.
 */
@Entity
@Table(name = "program", schema = "academic")
@Getter
@Setter
@NoArgsConstructor
public class Program {

    @Id
    @Column(name = "program_id")
    private Long programId;

    @Column(name = "faculty_code")
    private String facultyCode;

    @Column(name = "faculty_name")
    private String facultyName;

    @Column(name = "program_code")
    private String programCode;

    @Column(name = "degree_level")
    private String degreeLevel;

    @Column(name = "degree_name")
    private String degreeName;

    private String major;

    @Column(name = "major_concentration")
    private String majorConcentration;

    @Column(name = "required_credits")
    private BigDecimal requiredCredits;

    @Column(name = "is_active")
    private Boolean isActive;
}
