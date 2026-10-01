package com.utago.wordbook;

import com.utago.dictionary.Word;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 단어장에 "이 단어가 담겨 있다"는 멤버십 + 별표 여부.
 *
 * SRS(간격 반복) 학습 진행 상태(복습 횟수/다음 복습일/간격/난이도)는 더 이상 여기 없다 —
 * UserWordProgress로 옮겨졌다. 같은 단어가 여러 단어장(즐겨찾기 + 커스텀 단어장 등)에
 * 동시에 담겨 있을 수 있는데, 그 진행 상태는 어느 단어장에서 보든 항상 같아야 하기 때문
 * (단어장 항목마다 따로 가지고 있으면 한쪽에서 복습해도 다른 쪽엔 반영 안 되는 문제가 있었다).
 */
@Entity
@Table(name = "wordbook_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WordbookItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "wordbook_id", nullable = false)
    private Wordbook wordbook;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "word_id", nullable = false)
    private Word word;

    @Column(nullable = false)
    @Builder.Default
    private boolean starred = false;
}
