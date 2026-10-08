package com.utago.report;

/** 관리자가 신고 1건을 처리할 때 고르는 액션 — ReportService.resolveReport() 참고. */
public enum ReportAction {
    NONE,
    CONTENT_DELETED,
    AUTHOR_WARNED,
    AUTHOR_SUSPENDED
}
