package com.auwallet.academic.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "academic_term", schema = "academic")
@Getter
@Setter
@NoArgsConstructor
public class AcademicTerm {

    @Id
    @Column(name = "academic_term_id")
    private Long academicTermId;

    @Column(name = "term_code")
    private String termCode;

    @Column(name = "academic_year")
    private Integer academicYear;

    @Column(name = "semester_no")
    private Integer semesterNo;

    @Column(name = "term_label")
    private String termLabel;
}
