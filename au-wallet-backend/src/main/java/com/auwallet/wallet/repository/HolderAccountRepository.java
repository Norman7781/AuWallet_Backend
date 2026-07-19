package com.auwallet.wallet.repository;

import com.auwallet.wallet.entity.HolderAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface HolderAccountRepository extends JpaRepository<HolderAccount, Long> {

    Optional<HolderAccount> findByUniversityEmail(String universityEmail);

    boolean existsByUniversityEmail(String universityEmail);
}
