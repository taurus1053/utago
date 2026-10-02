package com.utago.content.dto;

/** "한 줄씩 보기"에서 지금 보고 있는 소절 순서(0-base) — SongController.updateProgress 참고. */
public record UpdateSongProgressRequest(int lineOrder) {
}
