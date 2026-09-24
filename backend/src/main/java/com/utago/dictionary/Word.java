package com.utago.dictionary;

import com.utago.common.Lang;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 노래와 무관한 중앙 마스터 사전. 모든 곡에서 재사용된다 (uk_words_lemma_lang).
 */
@Entity
@Table(name = "words")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Word {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 기본형 */
    @Column(nullable = false, length = 120)
    private String lemma;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Lang lang;

    /** 사전형 발음 */
    @Column(length = 120)
    private String reading;

    /** 품사 */
    @Column(length = 30)
    private String pos;

    /** 내부용 — 사용자에게 비노출 (학습 압박감 방지) */
    @Column(name = "jlpt_level", length = 5)
    private String jlptLevel;

    @Column(name = "dict_source", length = 60)
    private String dictSource;
}
