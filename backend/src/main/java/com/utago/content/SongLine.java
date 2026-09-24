package com.utago.content;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "song_lines")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SongLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_id", nullable = false)
    private Song song;

    @Column(name = "line_order", nullable = false)
    private int lineOrder;

    @Lob
    @Column(name = "original_text", nullable = false)
    private String originalText;

    /** 소절 아래 표시되는 뜻 — 의역 (직역 아님) */
    @Lob
    @Column(name = "translation_natural", nullable = false)
    private String translationNatural;

    @Column(name = "start_ms", nullable = false)
    private int startMs;

    @Column(name = "end_ms", nullable = false)
    private int endMs;
}
