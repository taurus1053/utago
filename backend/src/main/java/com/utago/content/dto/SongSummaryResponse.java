package com.utago.content.dto;

import com.utago.common.Lang;
import com.utago.content.AudioSourceType;
import com.utago.content.Song;

/**
 * 곡 목록/검색 화면용 요약 응답. 엔티티를 그대로 노출하지 않고
 * 화면에 필요한 필드만 골라 내려준다 (provenance, content_status 등은 내부용이라 제외).
 */
public record SongSummaryResponse(
        Long id,
        String title,
        String artist,
        Lang sourceLang,
        String youtubeVideoId,
        AudioSourceType audioSourceType
) {
    public static SongSummaryResponse from(Song song) {
        return new SongSummaryResponse(
                song.getId(),
                song.getTitle(),
                song.getArtist(),
                song.getSourceLang(),
                song.getYoutubeVideoId(),
                song.getAudioSourceType()
        );
    }
}
