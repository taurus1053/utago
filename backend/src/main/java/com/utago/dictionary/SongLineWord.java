package com.utago.dictionary;

import com.utago.content.SongLine;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 소절 안의 어느 구간(char offset)이 어떤 단어인지 매핑.
 * "단어장에 추가" 버튼, 소절 아래 단어 뜻 표시에 사용.
 */
@Entity
@Table(name = "song_line_words")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SongLineWord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_line_id", nullable = false)
    private SongLine songLine;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "word_id", nullable = false)
    private Word word;

    @Column(name = "char_offset_start", nullable = false)
    private int charOffsetStart;

    @Column(name = "char_offset_end", nullable = false)
    private int charOffsetEnd;
}
