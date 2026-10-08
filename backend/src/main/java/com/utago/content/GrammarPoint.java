package com.utago.content;

import com.utago.grammar.GrammarEntry;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "grammar_points")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GrammarPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_id", nullable = false)
    private Song song;

    @Column(nullable = false, length = 255)
    private String pattern;

    @Lob
    @Column(nullable = false)
    private String explanation;

    /** 이 문법 포인트를 실제로 보여주는 예시 소절 (nullable) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "example_song_line_id")
    private SongLine exampleSongLine;

    /**
     * 곡과 무관한 "문법 사전"(GrammarEntry)에서 같은 패턴을 찾아 연결한 것 — 2026-10-08 추가.
     * 기존 곡("문법 공부하기" 버튼)만 있던 데이터에는 null일 수 있다(GrammarPointService가
     * 곡 등록/재생성 시마다 채워준다). 이 연결 덕분에 GrammarEntry 상세 화면에서 "이 문법이
     * 쓰인 노래"를 역으로 찾을 수 있다(GrammarPointRepository.findByGrammarEntry_Id 참고).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "grammar_entry_id")
    private GrammarEntry grammarEntry;
}
