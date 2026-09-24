package com.utago.content;

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
}
