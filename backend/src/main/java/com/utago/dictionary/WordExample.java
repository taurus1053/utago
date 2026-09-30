package com.utago.dictionary;

import com.utago.content.SongLine;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 예문 하이브리드 소스: 곡 내 맥락 예문(SONG_LINE) 우선, 없으면 마스터 사전 예문(MASTER).
 * MASTER는 단어장에 담긴 단어가 아직 어느 공개 가사에도 등장하지 않았을 때, AI로 그 자리에서
 * 만들어 한 번만 생성하고 재사용한다(WordExampleService 참고).
 */
@Entity
@Table(name = "word_examples")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WordExample {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "word_id", nullable = false)
    private Word word;

    @Lob
    @Column(name = "example_text", nullable = false)
    private String exampleText;

    @Lob
    @Column(name = "example_translation", nullable = false)
    private String exampleTranslation;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 20)
    @Builder.Default
    private ExampleSourceType sourceType = ExampleSourceType.MASTER;

    /** source_type == SONG_LINE 일 때만 값이 있음 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_song_line_id")
    private SongLine sourceSongLine;

    /**
     * example_text를 "단어/조사 단위"로 쪼갠 JSON 문자열 배열(예: ["私","は","学校","へ",
     * "行きます"]) — 문장 재배열 게임에서 한 글자씩이 아니라 이 단위로 타일을 만드는 데 쓴다.
     * MASTER 예문은 AI가 함께 만들어주고(TranslationService.generateWordExamples), 없으면
     * null(문장 재배열엔 못 쓰지만 플래시카드/빈칸채우기/퀴즈엔 여전히 쓸 수 있음).
     */
    @Lob
    @Column(name = "tokens_json")
    private String tokensJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
