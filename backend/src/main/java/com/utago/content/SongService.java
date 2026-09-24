package com.utago.content;

import com.utago.common.Lang;
import com.utago.content.dto.SongSummaryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SongService {

    private final SongRepository songRepository;

    /**
     * 곡 검색/목록. 검색 기반 카탈로그 방향에 맞춰 항상 게시된(PUBLISHED) 곡만 노출한다.
     * query가 있으면 제목 검색 우선, 없고 lang만 있으면 언어 필터, 둘 다 없으면 전체 목록.
     */
    public Page<SongSummaryResponse> listSongs(String query, Lang lang, Pageable pageable) {
        Page<Song> page;
        if (query != null && !query.isBlank()) {
            page = songRepository.findByContentStatusAndTitleContainingIgnoreCase(
                    ContentStatus.PUBLISHED, query, pageable);
        } else if (lang != null) {
            page = songRepository.findByContentStatusAndSourceLang(
                    ContentStatus.PUBLISHED, lang, pageable);
        } else {
            page = songRepository.findByContentStatus(ContentStatus.PUBLISHED, pageable);
        }
        return page.map(SongSummaryResponse::from);
    }
}
