package com.utago.notification;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    /** 알림 드롭다운 목록 — 최신순. */
    Page<Notification> findByRecipientIdOrderByCreatedAtDesc(Long recipientId, Pageable pageable);

    /** 종 아이콘 배지 숫자. */
    long countByRecipientIdAndReadFalse(Long recipientId);

    /** "모두 읽음" 버튼 — 한 번에 일괄 처리(건별로 읽어와서 저장하지 않고 UPDATE 하나로). */
    @Modifying
    @Query("update Notification n set n.read = true where n.recipient.id = :recipientId and n.read = false")
    void markAllRead(@Param("recipientId") Long recipientId);
}
