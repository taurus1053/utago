package com.utago.content;

import com.utago.common.Lang;

/** 관리자 "추천곡 관리"/"곡 관리" 화면(검색 결과/현재 추천곡/전체 곡 목록)에서 곡 하나를
 * 나타내는 요약 정보. genre는 미지정이면 null(claude/소셜_마이페이지_기획.md 17-8번). */
public record AdminSongSummaryResponse(
        Long id, String title, String artist, Lang sourceLang, String youtubeVideoId,
        Visibility visibility, boolean featured, SongGenre genre
) {
    static AdminSongSummaryResponse from(Song song) {
        return new AdminSongSummaryResponse(
                song.getId(), song.getTitle(), song.getArtist(), song.getSourceLang(),
                song.getYoutubeVideoId(), song.getVisibility(), song.isFeatured(), song.getGenre()
        );
    }
}
