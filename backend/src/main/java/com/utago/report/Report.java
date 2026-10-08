package com.utago.report;

import com.utago.board.WordbookPost;
import com.utago.board.WordbookPostComment;
import com.utago.user.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 게시글/댓글 신고 1건 — claude/소셜_마이페이지_기획.md 23번. post/comment는 ON DELETE
 * SET NULL(V33 주석 참고)이라, 신고 처리 중 콘텐츠가 사라져도 이 행 자체는 감사 기록으로
 * 남는다 — 그 시점의 제목/본문은 targetSnapshot에, 작성자는 targetAuthor에 각각 스냅샷으로
 * 같이 저장해둔다(콘텐츠가 사라진 뒤에도 작성자 경고/정지는 그대로 할 수 있어야 하므로).
 */
@Entity
@Table(name = "reports")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reporter_id", nullable = false)
    private User reporter;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20)
    private ReportTargetType targetType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id")
    private WordbookPost post;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "comment_id")
    private WordbookPostComment comment;

    /** 신고 시점의 작성자 스냅샷 — 콘텐츠가 삭제돼도 경고/정지 대상을 특정할 수 있어야 함. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "target_author_id", nullable = false)
    private User targetAuthor;

    /** 신고 시점의 제목(글) 또는 본문 앞부분(댓글) 스냅샷. */
    @Column(name = "target_snapshot", nullable = false, length = 200)
    private String targetSnapshot;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ReportReason reason;

    @Column(length = 500)
    private String detail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ReportStatus status = ReportStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private ReportAction action = ReportAction.NONE;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolved_by_id")
    private User resolvedBy;
}
