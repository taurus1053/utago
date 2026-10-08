// 게시글/댓글 신고 — claude/소셜_마이페이지_기획.md 23번. 신고 처리(목록/액션)는
// admin.js 쪽(관리자 전용)에 있고, 여기는 일반 사용자가 신고를 "접수"하는 것만 담당.
import { apiPost } from './client'

// POST /api/reports { targetType: "POST" | "COMMENT", targetId, reason, detail? }
export async function createReport({ targetType, targetId, reason, detail }) {
  return apiPost('/api/reports', { targetType, targetId, reason, detail: detail || null })
}
