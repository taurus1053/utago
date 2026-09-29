package com.utago.content.dto;

/**
 * GET /api/songs/lookup?youtubeVideoId= 응답.
 *
 * 가사를 자동으로 만들어주지는 않는다 — 이미 우리 DB에 그 곡(같은 영상, 또는 같은
 * 제목+아티스트)이 등록돼 있으면 그 곡으로 바로 안내하고, 없으면 유튜브 공개 메타데이터
 * (oEmbed의 영상 제목/채널명)만 참고해서 제목/아티스트 입력칸을 채워주는 정도다.
 * 가사 원문은 여전히 사람이 입력해야 한다.
 */
public record SongLookupResponse(
        boolean matchedExisting,
        Long existingSongId,
        String suggestedTitle,
        String suggestedArtist,
        String youtubeTitle,
        String youtubeChannel
) {
    public static SongLookupResponse existing(Long songId) {
        return new SongLookupResponse(true, songId, null, null, null, null);
    }

    public static SongLookupResponse suggestion(
            String suggestedTitle, String suggestedArtist, String youtubeTitle, String youtubeChannel
    ) {
        return new SongLookupResponse(false, null, suggestedTitle, suggestedArtist, youtubeTitle, youtubeChannel);
    }
}
