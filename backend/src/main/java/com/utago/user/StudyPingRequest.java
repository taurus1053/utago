package com.utago.user;

/** 학습 화면이 약 30초마다 보내는 하트비트 — seconds는 그 간격 동안 실제로 화면에 머문
 * 시간(초). 클라이언트 값을 그대로 믿지 않고 서버에서 한 번에 더할 수 있는 최대치를
 * 제한한다(UserProfileService.addStudySeconds 참고). */
public record StudyPingRequest(int seconds) {
}
