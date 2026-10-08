package com.utago.report;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportRepository extends JpaRepository<Report, Long> {

    Page<Report> findByStatusOrderByCreatedAtAsc(ReportStatus status, Pageable pageable);

    Page<Report> findAllByOrderByCreatedAtDesc(Pageable pageable);

    boolean existsByReporterIdAndPostIdAndStatus(Long reporterId, Long postId, ReportStatus status);

    boolean existsByReporterIdAndCommentIdAndStatus(Long reporterId, Long commentId, ReportStatus status);
}
