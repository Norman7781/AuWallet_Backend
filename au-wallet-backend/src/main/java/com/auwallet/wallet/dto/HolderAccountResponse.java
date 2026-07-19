package com.auwallet.wallet.dto;

import com.auwallet.wallet.entity.HolderAccount;

import java.time.OffsetDateTime;

public record HolderAccountResponse(
        Long holderAccountId,
        String universityEmail,
        String personalEmail,
        String accountStatus,
        OffsetDateTime confirmedAt,
        OffsetDateTime createdAt
) {
    public static HolderAccountResponse from(HolderAccount account) {
        return new HolderAccountResponse(
                account.getHolderAccountId(),
                account.getUniversityEmail(),
                account.getPersonalEmail(),
                account.getAccountStatus(),
                account.getConfirmedAt(),
                account.getCreatedAt()
        );
    }
}
