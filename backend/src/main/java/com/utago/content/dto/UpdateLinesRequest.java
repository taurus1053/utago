package com.utago.content.dto;

import java.util.List;

/**
 * PUT /api/songs/{id}/lines 요청 — 가사 원문/의역에서 나중에 발견한 오탈자 등을 고칠 때 쓴다.
 * 타이밍(startMs/endMs)은 여기서 건드리지 않는다(UpdateSyncRequest가 그 담당).
 * originalText/translationNatural이 null이면 그 값은 건드리지 않는다 — 원문만 고치고
 * 번역은 그대로 두는 식의 부분 수정도 가능하게.
 */
public record UpdateLinesRequest(List<LineEdit> lines) {
    public record LineEdit(Long lineId, String originalText, String translationNatural) {}
}
