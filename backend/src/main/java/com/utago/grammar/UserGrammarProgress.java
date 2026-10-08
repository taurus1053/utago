package com.utago.grammar;

import com.utago.user.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 사용자 1명 + 문법 항목 1개에 대한 "학습 완료" 체크 상태 — 단어(UserWordProgress)처럼
 * SRS 복습까지는 가지 않고, 이번 범위에선 단순 learned 토글만 둔다(필요해지면 나중에
 * intervalDays 등을 추가해 확장 가능한 모양으로 설계).
 */
@Entity
@Table(name = "user_grammar_progress", uniqueConstraints = {
        @UniqueConstraint(name = "uk_user_grammar_progress", columnNames = {"user_id", "grammar_entry_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserGrammarProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "grammar_entry_id", nullable = false)
    private GrammarEntry grammarEntry;

    @Column(nullable = false)
    @Builder.Default
    private boolean learned = false;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
}
