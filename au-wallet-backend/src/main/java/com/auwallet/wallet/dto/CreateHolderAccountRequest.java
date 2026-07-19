package com.auwallet.wallet.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CreateHolderAccountRequest(

        @NotBlank
        @Email
        String universityEmail,

        @Email
        String personalEmail
) {
}
