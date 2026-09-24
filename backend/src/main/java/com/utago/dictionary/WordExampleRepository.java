package com.utago.dictionary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WordExampleRepository extends JpaRepository<WordExample, Long> {

    /** 플래시카드 예문 — 곡 맥락 예문(SONG_LINE) 우선, 없으면 마스터 예문(MASTER)으로 폴백은
     *  서비스 레이어에서 이 목록을 받아 source_type 우선순위로 고른다. */
    List<WordExample> findByWordId(Long wordId);

    List<WordExample> findByWordIdAndSourceType(Long wordId, ExampleSourceType sourceType);
}
