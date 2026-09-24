package com.utago.dictionary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SongLineWordRepository extends JpaRepository<SongLineWord, Long> {

    /** 재생 화면 — 소절 하나에 등장하는 단어들 (밑줄/팝업 표시용) */
    List<SongLineWord> findBySongLineId(Long songLineId);

    /** 여러 소절을 한 번에 불러올 때 (곡 전체 로드 시) */
    List<SongLineWord> findBySongLineIdIn(List<Long> songLineIds);
}
