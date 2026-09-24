package com.utago.auth;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SignupVerificationRepository extends JpaRepository<SignupVerification, String> {
}
