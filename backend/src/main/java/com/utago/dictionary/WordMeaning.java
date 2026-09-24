package com.utago.dictionary;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 다의어 처리: 문맥별로 매핑하지 않고, 빈도순으로 뜻 몇 가지를 사전식으로 나열한다
 * (파파고 사전 표시 방식 참고). displayOrder가 빈도순.
 */
@Entity
@Table(name = "word_meanings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WordMeaning {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "word_id", nullable = false)
    private Word word;

    @Column(name = "meaning_text", nullable = false, length = 255)
    private String meaningText;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private int displayOrder = 0;
}
