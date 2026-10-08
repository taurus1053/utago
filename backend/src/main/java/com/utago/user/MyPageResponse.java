package com.utago.user;

import com.utago.common.Lang;

// 마이페이지 프로필 카드 — claude/소셜_마이페이지_기획.md 5-1.
// title은 칭호 시스템 설계가 아직 안 끝나서(7번 열린 질문) 고정 placeholder 텍스트다.
// learningLangFlag도 지금은 일본어 학습만 지원해서 고정값("ja")이고, 나중에 다른 언어가
// 추가되면 User에 학습 언어 컬럼을 두고 실제 값으로 바꾸면 된다.
// nativeLang은 2026-10-08 추가 — 홈 화면이 "전체 곡" 언어 필터 탭에서 모국어 탭을
// 숨기기 위해 쓴다(모국어 노래는 배울 필요가 없으니, SongService.listSongs도 서버
// 단에서 모국어 곡을 자동으로 뺀다. 둘 다 User.nativeLang 하나를 기준으로 삼는다).
public record MyPageResponse(
        String nickname,
        String avatarColor,
        String avatarInitial,
        String statusMessage,
        String title,
        String learningLangFlag,
        Lang nativeLang
) {}
