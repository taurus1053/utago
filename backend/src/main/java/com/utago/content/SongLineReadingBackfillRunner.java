package com.utago.content;

import com.utago.common.Lang;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 서버 기동 시 한 번, 발음 표기(SongLineReading)가 아직 없는 기존 일본어 곡 소절(주로 이
 * 기능이 추가되기 전에 등록된 곡들)에 한국어 발음 표기를 채워준다.
 *
 * 멱등적 — 이미 표기가 있는 소절은 SongLineReadingService.generateKoReadings 안에서
 * 걸러지므로 매 기동마다 실행해도 안전하다. 한 번에 너무 많이 처리하면 기동이 느려지므로
 * 배치 상한을 둔다(남으면 다음 기동 때 이어서 처리됨).
 */
@Component
@RequiredArgsConstructor
public class SongLineReadingBackfillRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SongLineReadingBackfillRunner.class);
    private static final int MAX_LINES_PER_STARTUP = 500;

    private final SongRepository songRepository;
    private final SongLineRepository songLineRepository;
    private final SongLineReadingRepository songLineReadingRepository;
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

        List<Long> lineIds = allLines.stream().map(SongLine::getId).toList();
        Set<Long> haveReading = songLineReadingRepository.findBySongLineIdInAndTargetLang(lineIds, Lang.KO).stream()
                .map(r -> r.getSongLine().getId())
                .collect(Collectors.toSet());

        List<SongLine> missing = allLines.stream()
                .filter(l -> !haveReading.contains(l.getId()))
                .limit(MAX_LINES_PER_STARTUP)
                .toList();
        if (missing.isEmpty()) {
            return;
        }

        log.info("[SongLineReadingBackfillRunner] 발음 표기 없는 소절 {}건 백필 시작", missing.size());
        int filled = songLineReadingService.generateKoReadings(missing);
        log.info("[SongLineReadingBackfillRunner] 백필 완료 — {}개 소절에 발음 표기 채움", filled);
    }
}
