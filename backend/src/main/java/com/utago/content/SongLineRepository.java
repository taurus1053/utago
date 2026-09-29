package com.utago.content;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SongLineRepository extends JpaRepository<SongLine, Long> {

    /** 재생 화면 — 곡 하나의 전체 가사를 소절 순서대로 */
    List<SongLine> findBySongIdOrderByLineOrderAsc(Long songId);

    /** 발음 표기 백필 등 배치 작업용 — 여러 곡의 소절을 한 번에 조회 */
    List<SongLine> findBySongIdIn(List<Long> songIds);
}
