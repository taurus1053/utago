package com.utago.wordbook;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserWordProgressRepository extends JpaRepository<UserWordProgress, Long> {

    Optional<UserWordProgress> findByUser_IdAndWord_Id(Long userId, Long wordId);

    /** 단어장 화면에서 여러 단어의 진행 상태를 한 번에 조회할 때 쓴다. */
    List<UserWordProgress> findByUser_IdAndWord_IdIn(Long userId, List<Long> wordIds);
}
