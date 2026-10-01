package com.utago.board;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WordbookPostRepository extends JpaRepository<WordbookPost, Long> {

    /** 최신순 — 공식 글 먼저, 그다음 최신. */
    Page<WordbookPost> findAllByOrderByOfficialDescCreatedAtDesc(Pageable pageable);

    /** 인기순 — 공식 글 먼저, 그다음 좋아요 많은 순. */
    Page<WordbookPost> findAllByOrderByOfficialDescLikeCountDescCreatedAtDesc(Pageable pageable);

    /** 다운로드순 — 첨부 단어장의 download_count 기준(wordbooks.download_count 참고).
     *  "Wordbook_DownloadCount"처럼 밑줄로 중첩 경로를 명시해야, Spring Data가 엉뚱하게
     *  property를 쪼개는 것을 막고 정확히 wordbook.downloadCount로 해석한다. */
    Page<WordbookPost> findAllByOrderByOfficialDescWordbook_DownloadCountDescCreatedAtDesc(Pageable pageable);

    List<WordbookPost> findByAuthorIdOrderByCreatedAtDesc(Long authorId);

    List<WordbookPost> findByWordbookId(Long wordbookId);
}
