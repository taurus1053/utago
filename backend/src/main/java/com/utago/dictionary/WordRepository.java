package com.utago.dictionary;

import com.utago.common.Lang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface WordRepository extends JpaRepository<Word, Long> {

    /** 콘텐츠 파이프라인에서 단어 추출 시 마스터 사전에 이미 있는지 확인/재사용 (uk_words_lemma_lang) */
    Optional<Word> findByLemmaAndLang(String lemma, Lang lang);

    /** 단어장 담김 여부 일괄 조회(WordbookService.findWordbookIdsContainingBatch)에 쓰는 배치 조회. */
    List<Word> findByLemmaInAndLang(List<String> lemmas, Lang lang);

    /** 앱 기동 시 사전형 읽기 재검증/복구(WordReadingRepairRunner)에 쓰는 언어별 전체 조회. */
    List<Word> findByLang(Lang lang);

    /** 홈 화면 "오늘의 단어" — 뜻이 있는 단어 중 아무거나 하나 무작위로 고른다. */
    @Query(value = "SELECT w.* FROM words w JOIN word_meanings wm ON wm.word_id = w.id " +
            "WHERE w.lang = :lang ORDER BY RAND() LIMIT 1", nativeQuery = true)
    Optional<Word> findRandomWithMeaningByLang(@Param("lang") String lang);

    /**
     * 빈칸 채우기 오답 보기용 — 발음(읽는 법)의 첫 글자가 같은, 즉 헷갈리기 쉬운 단어를
     * 무작위로 몇 개 찾는다(예: "行く"와 "行った"처럼 비슷하게 들리는 단어). 자기 자신은 제외.
     */
    @Query(value = "SELECT w.* FROM words w JOIN word_meanings wm ON wm.word_id = w.id " +
            "WHERE w.lang = :lang AND w.id <> :excludeId AND w.reading LIKE CONCAT(:prefix, '%') " +
            "GROUP BY w.id ORDER BY RAND() LIMIT :limit", nativeQuery = true)
    List<Word> findSimilarByReadingPrefix(
            @Param("lang") String lang, @Param("prefix") String prefix,
            @Param("excludeId") Long excludeId, @Param("limit") int limit);

    /**
     * 위 발음 기반 검색으로 충분히 못 채웠을 때 채워 넣을 — 같은 언어의 무작위 단어(뜻이 있는
     * 것만). excludeIds가 비어있으면 안 되므로(네이티브 SQL "NOT IN ()" 문법 오류 방지)
     * 서비스단에서 항상 최소 하나(-1 등)를 넣어 호출한다.
     */
    @Query(value = "SELECT w.* FROM words w JOIN word_meanings wm ON wm.word_id = w.id " +
            "WHERE w.lang = :lang AND w.id NOT IN (:excludeIds) " +
            "GROUP BY w.id ORDER BY RAND() LIMIT :limit", nativeQuery = true)
    List<Word> findRandomWithMeaningByLangExcluding(
            @Param("lang") String lang, @Param("excludeIds") List<Long> excludeIds, @Param("limit") int limit);
}
