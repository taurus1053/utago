package com.utago.grammar;

import com.utago.common.Lang;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 곡과 무관한 "문법 사전" 마스터 데이터 한 건 — /grammar 화면(레벨별 목록/상세)의 원천.
 * 기존 곡별 GrammarPoint("이 곡에 나온 패턴")와는 별개 개념이지만, GrammarPointService가
 * 곡의 문법 포인트를 생성할 때 여기서 같은 패턴을 찾아(또는 새로 만들어) GrammarPoint.
 * grammarEntry로 연결해준다 — 그래서 이 문법 상세 화면에 "이 문법이 쓰인 노래" 역추적이
 * 공짜로 따라온다(GrammarPointRepository.findByGrammarEntry_Id 참고).
 *
 * pattern은 사용자에게 보여줄 표제(예: "〜ている", "〜なければならない") — 대소문자/공백
 * 차이로 중복 생성되지 않도록 GrammarEntryService가 저장 전에 정규화해서 비교한다.
 */
@Entity
@Table(name = "grammar_entries")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GrammarEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Lang lang;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 5)
    private GrammarLevel level;

    @Column(nullable = false, length = 255)
    private String pattern;

    @Column(nullable = false, length = 500)
    private String meaning;

    @Lob
    @Column(nullable = false)
    private String explanation;

    /** 접속 형태 등 구조 설명 (예: "동사 て형 + いる") — 없을 수 있음. */
    @Column(length = 500)
    private String structure;

    /** 이 문법 패턴을 보여주는 자체 예문(곡 맥락이 아닌, 이 문법만을 위한 예문). */
    @Lob
    private String exampleSentence;

    @Lob
    private String exampleTranslation;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
