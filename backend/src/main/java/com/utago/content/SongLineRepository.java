package com.utago.content;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SongLineRepository extends JpaRepository<SongLine, Long> {

    /** 재생 화면 — 곡 하나의 전체 가사를 소절 순서대로 */
    List<SongLine> findBySongIdOrderByLineOrderAsc(Long songId);

    /** 발음 표기 백필 등 배치 작업용 — 여러 곡의 소절을 한 번에 조회 */
    List<SongLine> findBySongIdIn(List<Long> songIds);

    /** 마이페이지 학습 통계 — "완료한 가사/곡" 판정에 곡의 전체 줄 수가 필요하다. */
    int countBySongId(Long songId);

    /**
     * 홈 화면 "오늘의 가사" — 공개(PUBLIC+PUBLISHED) 곡이거나 본인이 등록한 곡의 소절 중
     * 무작위로 하나. 다른 사용자의 PRIVATE 곡 가사가 섞이지 않도록 예문 조회와 같은
     * 가시성 규칙을 쓴다(SongLineWordRepository.findVisibleExamplesByWordIdIn 참고).
     */
    @Query(value = "SELECT sl.* FROM song_lines sl JOIN songs s ON sl.song_id = s.id " +
            "WHERE ((s.visibility = 'PUBLIC' AND s.content_status = 'PUBLISHED') OR s.owner_user_id = :userId) " +
            "ORDER BY RAND() LIMIT 1", nativeQuery = true)
    Optional<SongLine> findRandomVisibleLine(@Param("userId") Long userId);

    /**
     * 홈 화면 "가사 복습하기" — 내 단어장(즐겨찾기 포함 전체)에 담긴 단어가 실제로 등장하는
     * 소절 중 무작위로 하나. "오늘의 가사"와 같은 가시성 규칙(공개 곡이거나 본인 곡)을 쓴다.
     * 단어장에 담긴 단어가 어느 공개 가사에도 등장하지 않으면 empty.
     */
    @Query(value = "SELECT DISTINCT sl.* FROM song_lines sl " +
            "JOIN songs s ON sl.song_id = s.id " +
            "JOIN song_line_words slw ON slw.song_line_id = sl.id " +
            "JOIN wordbook_items wi ON wi.word_id = slw.word_id " +
            "JOIN wordbooks wb ON wi.wordbook_id = wb.id " +
            "WHERE wb.user_id = :userId " +
            "AND ((s.visibility = 'PUBLIC' AND s.content_status = 'PUBLISHED') OR s.owner_user_id = :userId) " +
            "ORDER BY RAND() LIMIT 1", nativeQuery = true)
    Optional<SongLine> findRandomReviewLineForUser(@Param("userId") Long userId);
}
