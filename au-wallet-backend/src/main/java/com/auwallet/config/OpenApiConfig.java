package com.auwallet.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI auWalletOpenApi() {
        return new OpenAPI().info(new Info()
                .title("AU Wallet Backend API")
                .description("""
                        Wallet account creation, onboarding submission, and identity matching
                        against the (synthetic) VMES academic database.

                        Verifiable Credential issuance and Verifiable Presentation flows are
                        NOT implemented yet. This service currently only answers:
                        who is this holder, and which academic enrollment (if any) matched.
                        """)
                .version("v0.1 (pre-VC/VP)")
                .contact(new Contact().name("AU Wallet Team")));
    }
}
