package com.auwallet.academic.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "transcript", schema = "academic")
@Getter
@Setter
@NoArgsConstructor
public class Transcript {

    @Id
    @Column(name = "transcript_id")
    private Long transcriptId;

    @Column(name = "enrollment_id")
    private Long enrollmentId;

    @Column(name = "document_number")
    private String documentNumber;

    @Column(name = "verification_code")
    private String verificationCode;

    @Column(name = "issued_on")
    private LocalDate issuedOn;

    @Column(name = "is_certified_true_copy")
    private Boolean isCertifiedTrueCopy;

    /** draft | issued | revoked */
    @Column(name = "document_status")
    private String documentStatus;

    @Column(name = "registrar_name")
    private String registrarName;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}
