package com.auwallet.academic.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "course", schema = "academic")
@Getter
@Setter
@NoArgsConstructor
public class Course {

    @Id
    @Column(name = "course_id")
    private Long courseId;

    @Column(name = "program_id")
    private Long programId;

    @Column(name = "course_code")
    private String courseCode;

    @Column(name = "course_title")
    private String courseTitle;

    @Column(name = "default_credits")
    private BigDecimal defaultCredits;

    @Column(name = "course_category")
    private String courseCategory;

    @Column(name = "is_active")
    private Boolean isActive;
}
