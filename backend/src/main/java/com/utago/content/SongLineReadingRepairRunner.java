package com.utago.content;

import com.utago.common.Lang;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 서버 기동 시마다, 이미 저장된 한국어 발음 표기(SongLineReading)를 현재 변환 규칙으로
 * 다시 계산해서 달라진 것만 고쳐준다.
 *
 * 왜 필요한가 — 조사 は/を/へ의 발음 특례(는 わ/お/え로 읽힘, JapaneseTokenizerService.
 * applyParticlePronunciation 참고)가 처음엔 반영되지 않아서, "君の運命のヒトは" 같은 줄이
 * "…히토하"로 잘못 저장된 적이 있었다(2026-10-02 발견). SongLineReadingBackfillRunner는
 * "표기가 아예 없는" 소절만 채우기 때문에 이미 틀리게 캐시된 건 못 고친다 — 그래서 별도로
 * 전부 다시 계산해서 비교 후 다른 것만 덮어쓰는 복구 러너를 둔다.
 *
 * 멱등적 — 이미 올바른 표기는 건드리지 않는다(비교 후 다르면만 갱신). 곡이 늘어나면 매
 * 기동마다 전체 재계산 비용이 커질 수 있으니, 나중에 변환 규칙이 또 바뀌면 이 러너를 다시
 * 켜거나(현재는 상시 실행) 1회성으로 돌리는 방식으로 바꿔도 된다.
 */
@Component
@RequiredArgsConstructor
@Order(2) // SongLineReadingBackfillRunner(없는 표기 채우기) 다음 — 채운 뒤에 전체를 다시 검사
public class SongLineReadingRepairRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SongLineReadingRepairRunner.class);

    private final SongRepository songRepository;
    private final SongLineRepository songLineRepository;
    private final SongLineReadingService songLineReadingService;

    @Override
    @Transactional
    public void run(String... args) {
        List<Song> japaneseSongs = songRepository.findBySourceLang(Lang.JA);
        if (japaneseSongs.isEmpty()) {
            return;
        }

        List<Long> songIds = japaneseSongs.stream().map(Song::getId).toList();
        List<SongLine> allLines = songLineRepository.findBySongIdIn(songIds);
        if (allLines.isEmpty()) {
            return;
        }

        int fixed = songLineReadingService.repairKoReadings(allLines);
        if (fixed > 0) {
            log.info("[SongLineReadingRepairRunner] 발음 표기 불일치 {}건 복구(조사 は/を/へ 특례 등)", fixed);
        }
    }
}
