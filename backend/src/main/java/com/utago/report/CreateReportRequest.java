package com.utago.report;

// POST /api/reports — targetId는 targetType이 POST면 게시글 id, COMMENT면 댓글 id.
// detail(신고 상세 사유)은 선택 입력.
public record CreateReportRequest(ReportTargetType targetType, Long targetId, ReportReason reason, String detail) {}
