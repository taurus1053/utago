package com.utago.user;

/**
 * 칭호 정의 하나(코드/카테고리/이름/조건값/단위). DB 테이블이 아니라 TitleCatalog에 정적으로
 * 정의한다 — "달성 여부"는 매번 현재 통계와 threshold를 비교해서 계산하면 되므로, 사용자별
 * 달성 이력을 따로 저장할 필요가 없다(TitleService 참고).
 */
public record Title(String code, TitleCategory category, String name, long threshold, String unit) {
}
