package com.utago.report;

import java.time.LocalDateTime;

// 관리자 "신고 관리" 화면용 응답. targetSnapshot/targetAuthorNickname은 신고 시점 스냅샷이라
// 콘텐츠가 이미 삭제됐어도(targetDeleted=true) 그대로 보인다.
public record ReportResponse(
        Long id,
        ReportTargetType targetType,
        boolean targetDeleted,
        String targetSnapshot,
        String targetAuthorNickname,
        String reporterNickname,
        ReportReason reason,
        String detail,
        ReportStatus status,
        ReportAction action,
        LocalDateTime createdAt,
        LocalDateTime resolvedAt
) {
    static ReportResponse of(Report r) {
        boolean deleted = switch (r.getTargetType()) {
            case POST -> r.getPost() == null;
            case COMMENT -> r.getComment() == null;
        };
        return new ReportResponse(
                r.getId(),
                r.getTargetType(),
                deleted,
                r.getTargetSnapshot(),
                r.getTargetAuthor().getNickname(),
                r.getReporter().getNickname(),
                r.getReason(),
                r.getDetail(),
                r.getStatus(),
                r.getAction(),
                r.getCreatedAt(),
                r.getResolvedAt()
        );
    }
}
