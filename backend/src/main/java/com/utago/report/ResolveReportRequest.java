package com.utago.report;

// POST /api/admin/reports/{id}/resolve — action은 REJECT 대신 그냥 reject 여부를
// status로 따로 표현하지 않고, ReportAction 중 NONE(=기각)/CONTENT_DELETED/AUTHOR_WARNED/
// AUTHOR_SUSPENDED 중 하나를 그대로 받는다. suspendDays는 action=AUTHOR_SUSPENDED일 때만
// 쓰이고, 비우면 기본 7일.
public record ResolveReportRequest(ReportAction action, Integer suspendDays) {}
