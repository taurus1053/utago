package com.utago.dictionary;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SongLineWordRepository extends JpaRepository<SongLineWord, Long> {

    /** 재생 화면 — 소절 하나에 등장하는 단어들 (밑줄/팝업 표시용) */
    List<SongLineWord> findBySongLineId(Long songLineId);

    /** 여러 소절을 한 번에 불러올 때 (곡 전체 로드 시) */
    List<SongLineWord> findBySongLineIdIn(List<Long> songLineIds);

    /** 곡 하나를 삭제/재분석할 때 기존 단어 매핑을 정리하기 위함(현재는 등록 시 1회만 생성) */
    List<SongLineWord> findBySongLineIdInOrderByCharOffsetStartAsc(List<Long> songLineIds);

    /**
     * "오늘의 단어"/단어장 학습(빈칸 채우기·문장 재배열)에 쓸 예문(실제 가사 소절) 조회용.
     * Word는 모든 곡에서 공유되는 마스터 사전이라, 아무 소절이나 골라버리면 다른 사용자의
     * PRIVATE 곡 가사가 노출될 수 있다 — 그래서 공개(PUBLIC+PUBLISHED) 곡이거나 본인이
     * 등록한 곡의 소절만 예문 후보로 허용한다.
     */
    @Query("SELECT slw FROM SongLineWord slw JOIN slw.songLine sl JOIN sl.song s " +
            "WHERE slw.word.id IN :wordIds " +
            "AND ((s.visibility = com.utago.content.Visibility.PUBLIC AND s.contentStatus = com.utago.content.ContentStatus.PUBLISHED) " +
            "OR s.ownerUserId = :userId)")
    List<SongLineWord> findVisibleExamplesByWordIdIn(@Param("wordIds") List<Long> wordIds, @Param("userId") Long userId);
}
