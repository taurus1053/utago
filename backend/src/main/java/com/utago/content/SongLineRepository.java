package com.utago.content;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SongLineRepository extends JpaRepository<SongLine, Long> {

    /** 재생 화면 — 곡 하나의 전체 가사를 소절 순서대로 */
    List<SongLine> findBySongIdOrderByLineOrderAsc(Long songId);
}
