package com.auwallet.academic.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "course_result", schema = "academic")
@Getter
@Setter
@NoArgsConstructor
public class CourseResult {

    @Id
    @Column(name = "course_result_id")
    private Long courseResultId;

    @Column(name = "enrollment_id")
    private Long enrollmentId;

    /** nullable when result_type = transfer */
    @Column(name = "academic_term_id")
    private Long academicTermId;

    @Column(name = "course_id")
    private Long courseId;

    private BigDecimal credits;

    private String grade;

    /** normal | transfer | seminar | pass_fail */
    @Column(name = "result_type")
    private String resultType;
}
