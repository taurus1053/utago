package com.utago.dictionary;

import com.utago.content.SongLine;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 예문 하이브리드 소스: 곡 내 맥락 예문(SONG_LINE) 우선, 없으면 마스터 사전 예문(MASTER).
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
}
