package com.utago.content;

import com.utago.common.Lang;

/** 관리자 "추천곡 관리" 화면(검색 결과/현재 추천곡 목록)에서 곡 하나를 나타내는 요약 정보. */
public record AdminSongSummaryResponse(
        Long id, String title, String artist, Lang sourceLang, String youtubeVideoId,
        Visibility visibility, boolean featured
) {
    static AdminSongSummaryResponse from(Song song) {
        return new AdminSongSummaryResponse(
                song.getId(), song.getTitle(), song.getArtist(), song.getSourceLang(),
                song.getYoutubeVideoId(), song.getVisibility(), song.isFeatured()
        );
    }
}
