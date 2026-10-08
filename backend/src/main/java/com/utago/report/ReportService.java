package com.utago.report;

import com.utago.board.WordbookPost;
import com.utago.board.WordbookPostComment;
import com.utago.board.WordbookPostCommentRepository;
import com.utago.board.WordbookPostRepository;
import com.utago.board.WordbookPostService;
import com.utago.notification.NotificationService;
import com.utago.user.User;
import com.utago.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 게시판 신고/모더레이션 — claude/소셜_마이페이지_기획.md 23번. 사용자는 게시글/댓글을
 * 신고만 할 수 있고(POST /api/reports), 처리는 전부 관리자 전용(AdminReportController).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportService {

    private static final int DEFAULT_SUSPEND_DAYS = 7;
    private static final int SNAPSHOT_LIMIT = 100;

    private final ReportRepository reportRepository;
    private final UserRepository userRepository;
    private final WordbookPostRepository postRepository;
    private final WordbookPostCommentRepository commentRepository;
    private final WordbookPostService wordbookPostService;
    private final NotificationService notificationService;

    @Transactional
    public void createReport(Long reporterId, ReportTargetType targetType, Long targetId,
                              ReportReason reason, String detail) {
        if (targetType == null || targetId == null) {
            throw new IllegalStateException("신고 대상을 확인할 수 없어요.");
        }
        if (reason == null) {
            throw new IllegalStateException("신고 사유를 선택해주세요.");
        }
        User reporter = userRepository.findById(reporterId)
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));

        Report.ReportBuilder builder = Report.builder()
                .reporter(reporter)
                .targetType(targetType)
                .reason(reason)
                .detail(detail == null || detail.isBlank() ? null : detail.trim());

        if (targetType == ReportTargetType.POST) {
            WordbookPost post = postRepository.findById(targetId)
                    .orElseThrow(() -> new IllegalStateException("게시글을 찾을 수 없어요."));
            if (post.getAuthor().getId().equals(reporterId)) {
                throw new IllegalStateException("본인 게시글은 신고할 수 없어요.");
            }
            if (reportRepository.existsByReporterIdAndPostIdAndStatus(reporterId, targetId, ReportStatus.PENDING)) {
                throw new IllegalStateException("이미 신고 접수된 게시글이에요.");
            }
            builder.post(post).targetAuthor(post.getAuthor()).targetSnapshot(truncate(post.getTitle()));
        } else {
            WordbookPostComment comment = commentRepository.findById(targetId)
                    .orElseThrow(() -> new IllegalStateException("댓글을 찾을 수 없어요."));
            if (comment.getAuthor().getId().equals(reporterId)) {
                throw new IllegalStateException("본인 댓글은 신고할 수 없어요.");
            }
            if (reportRepository.existsByReporterIdAndCommentIdAndStatus(reporterId, targetId, ReportStatus.PENDING)) {
                throw new IllegalStateException("이미 신고 접수된 댓글이에요.");
            }
            builder.comment(comment).targetAuthor(comment.getAuthor()).targetSnapshot(truncate(comment.getContent()));
        }

        reportRepository.save(builder.build());
    }

    /** 관리자 "신고 관리" 화면 — status가 없으면(null) 전체를 최신순으로, 있으면 그 상태만
     * 오래된 순(처리 안 된 건 먼저 처리하라는 의도)으로 보여준다. */
    public Page<ReportResponse> listReports(ReportStatus status, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50));
        Page<Report> reports = status == null
                ? reportRepository.findAllByOrderByCreatedAtDesc(pageable)
                : reportRepository.findByStatusOrderByCreatedAtAsc(status, pageable);
        return reports.map(ReportResponse::of);
    }

    @Transactional
    public ReportResponse resolveReport(Long adminUserId, Long reportId, ReportAction action, Integer suspendDays) {
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new IllegalStateException("신고를 찾을 수 없어요."));
        if (report.getStatus() != ReportStatus.PENDING) {
            throw new IllegalStateException("이미 처리된 신고예요.");
        }
        User admin = userRepository.findById(adminUserId)
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));

        ReportAction resolvedAction = action == null ? ReportAction.NONE : action;
        // CONTENT_DELETED면 콘텐츠가 사라지므로, 알림에 쓸 targetUrl은 삭제 전에 미리 뽑아둔다.
        String targetUrl = resolveTargetUrl(report);

        switch (resolvedAction) {
            case CONTENT_DELETED -> deleteTargetContentIfPresent(report);
            case AUTHOR_WARNED -> {
                User author = report.getTargetAuthor();
                author.setWarningCount(author.getWarningCount() + 1);
            }
            case AUTHOR_SUSPENDED -> {
                User author = report.getTargetAuthor();
                int days = suspendDays != null && suspendDays > 0 ? suspendDays : DEFAULT_SUSPEND_DAYS;
                author.setSuspendedUntil(LocalDateTime.now().plusDays(days));
            }
            case NONE -> { /* 기각 — 콘텐츠/작성자에 아무 조치도 하지 않는다. */ }
        }

        report.setStatus(resolvedAction == ReportAction.NONE ? ReportStatus.REJECTED : ReportStatus.RESOLVED);
        report.setAction(resolvedAction);
        report.setResolvedAt(LocalDateTime.now());
        report.setResolvedBy(admin);

        notifyResolution(adminUserId, report, resolvedAction, suspendDays, targetUrl);

        return ReportResponse.of(report);
    }

    private String resolveTargetUrl(Report report) {
        if (report.getTargetType() == ReportTargetType.POST) {
            return report.getPost() != null ? "/board/" + report.getPost().getId() : "/board";
        }
        return report.getComment() != null ? "/board/" + report.getComment().getPost().getId() : "/board";
    }

    /** 신고 처리 결과 알림(claude/소셜_마이페이지_기획.md 24번) — 신고자에게는 항상,
     * 경고/정지 조치를 받은 작성자에게는 추가로 보낸다. */
    private void notifyResolution(Long adminUserId, Report report, ReportAction action, Integer suspendDays, String targetUrl) {
        String targetLabel = report.getTargetType() == ReportTargetType.POST ? "게시글" : "댓글";
        String reporterMessage = switch (action) {
            case NONE -> "신고하신 " + targetLabel + "을 검토했지만, 별도 조치는 하지 않기로 했어요.";
            case CONTENT_DELETED -> "신고하신 " + targetLabel + "이 삭제 처리됐어요.";
            case AUTHOR_WARNED -> "신고하신 " + targetLabel + "의 작성자에게 경고 조치를 내렸어요.";
            case AUTHOR_SUSPENDED -> {
                int days = suspendDays != null && suspendDays > 0 ? suspendDays : DEFAULT_SUSPEND_DAYS;
                yield "신고하신 " + targetLabel + "의 작성자가 " + days + "일간 이용 정지됐어요.";
            }
        };
        notificationService.notifyReportResolved(adminUserId, report.getReporter().getId(), reporterMessage, targetUrl);

        if (action == ReportAction.AUTHOR_WARNED || action == ReportAction.AUTHOR_SUSPENDED) {
            String authorMessage = action == ReportAction.AUTHOR_WARNED
                    ? "작성하신 " + targetLabel + "이 신고되어 경고 조치를 받았어요."
                    : "작성하신 " + targetLabel + "이 신고되어 이용이 정지됐어요.";
            notificationService.notifyReportResolved(adminUserId, report.getTargetAuthor().getId(), authorMessage, targetUrl);
        }
    }

    private void deleteTargetContentIfPresent(Report report) {
        if (report.getTargetType() == ReportTargetType.POST) {
            if (report.getPost() != null) {
                wordbookPostService.adminDeletePost(report.getPost().getId());
                // DB FK는 ON DELETE SET NULL이지만, 이미 로드된 이 엔티티는 자동 반영되지
                // 않으므로 응답(ReportResponse.of)의 targetDeleted가 바로 true로 보이도록 직접 비운다.
                report.setPost(null);
            }
        } else {
            if (report.getComment() != null) {
                wordbookPostService.adminDeleteComment(report.getComment().getId());
                report.setComment(null);
            }
        }
    }

    private String truncate(String text) {
        if (text == null) return "";
        String trimmed = text.trim();
        return trimmed.length() > SNAPSHOT_LIMIT ? trimmed.substring(0, SNAPSHOT_LIMIT) + "…" : trimmed;
    }
}
