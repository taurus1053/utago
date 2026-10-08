package com.utago.user;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByNickname(String nickname);

    /** JLPT 프리셋 단어장 등 "운영진 소유"로 만들어야 하는 데이터의 소유자를 찾을 때 씀. */
    Optional<User> findFirstByRole(Role role);

    /** 친구 검색(claude/소셜_마이페이지_기획.md 4-2번, 18번) — 본인은 결과에서 제외,
     * Pageable로 개수 제한(컨트롤러에서 PageRequest.of(0, 20) 정도로 넘김). */
    List<User> findByNicknameContainingIgnoreCaseAndIdNot(String nickname, Long excludeId, Pageable pageable);
}
