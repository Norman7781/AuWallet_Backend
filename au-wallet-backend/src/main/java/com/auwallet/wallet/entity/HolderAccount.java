package com.auwallet.wallet.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Mirrors wallet.holder_account. Does not store passwords, auth-provider IDs,
 * or an official name - the official name is only ever resolved through a
 * successful match against academic.student.
 */
@Entity
@Table(name = "holder_account", schema = "wallet")
@Getter
@Setter
@NoArgsConstructor
public class HolderAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "holder_account_id")
    private Long holderAccountId;

    // this university email is knowledgeable / optional 
    @Column(name = "university_email", nullable = false, unique = true)
    private String universityEmail;

    @Column(name = "personal_email")
    private String personalEmail;

    /** pending | active | rejected | suspended */
    @Column(name = "account_status", nullable = false)
    private String accountStatus = "pending";

    @Column(name = "confirmed_at")
    private OffsetDateTime confirmedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.accountStatus == null) {
            this.accountStatus = "pending";
        }
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
