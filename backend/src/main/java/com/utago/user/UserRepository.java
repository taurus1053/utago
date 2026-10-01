package com.utago.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByNickname(String nickname);

    /** JLPT 프리셋 단어장 등 "운영진 소유"로 만들어야 하는 데이터의 소유자를 찾을 때 씀. */
    Optional<User> findFirstByRole(Role role);
}
