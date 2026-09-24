package com.utago.content;

import com.utago.common.Lang;
import com.utago.content.dto.SongSummaryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class SongController {

    private final SongService songService;

    /**
     * GET /api/songs
     * GET /api/songs?query=아이유
     * GET /api/songs?lang=JA&page=0&size=20
     */
    @GetMapping("/api/songs")
    public Page<SongSummaryResponse> listSongs(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Lang lang,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        return songService.listSongs(query, lang, pageable);
    }
}
