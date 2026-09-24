package com.utago.content;

import com.utago.common.Lang;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SongLineReadingRepository extends JpaRepository<SongLineReading, Long> {

    /** 소절 하나 + 보는 사용자의 모국어 -> 발음 표기 1건 (uk_readings_line_lang과 대응) */
    Optional<SongLineReading> findBySongLineIdAndTargetLang(Long songLineId, Lang targetLang);

    /** 곡 전체를 한 번에 불러올 때, 특정 언어권 발음을 소절 ID 목록으로 일괄 조회 */
    List<SongLineReading> findBySongLineIdInAndTargetLang(List<Long> songLineIds, Lang targetLang);
}
