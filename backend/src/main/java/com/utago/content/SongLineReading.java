package com.utago.content;

import com.utago.common.Lang;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 소절의 발음 표기. 노래 자체 속성이 아니라 "보는 사용자의 모국어"에 종속되므로
 * song_lines와 분리했다 (한 소절당 KO/JA/EN 각각 최대 1개 — uk_readings_line_lang).
 */
@Entity
@Table(name = "song_line_readings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SongLineReading {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_line_id", nullable = false)
    private SongLine songLine;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_lang", nullable = false, length = 10)
    private Lang targetLang;

    /** 가타카나 / 한글 발음 / 로마자 — target_lang에 따라 형식이 달라짐 */
    @Lob
    @Column(name = "reading_text", nullable = false)
    private String readingText;
}
