package com.utago.content;

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
 * 서버 기동 시 한 번, 문법 포인트(GrammarPoint)가 아직 하나도 없는 기존 곡(이 기능이 생기기
 * 전에 등록된 곡들)에 AI로 문법 포인트를 생성해준다 — DictionaryBackfillRunner와 같은
 * "멱등적 소급 백필" 패턴. 이미 문법 포인트가 있는 곡은 건드리지 않으므로 매 기동마다
 * 실행해도 안전하고, 곡마다 Claude 호출이 1회씩 들어가 기동이 느려지지 않도록 배치 상한을
 * 둔다(남으면 다음 기동 때 이어서 처리됨).
 */
@Component
@RequiredArgsConstructor
public class GrammarPointBackfillRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(GrammarPointBackfillRunner.class);
    private static final int MAX_SONGS_PER_STARTUP = 10;

    private final SongRepository songRepository;
    private final SongLineRepository songLineRepository;
    private final GrammarPointRepository grammarPointRepository;
    private final GrammarPointService grammarPointService;

    @Override
    @Transactional
    public void run(String... args) {
        if (!grammarPointService.isAvailable()) {
            log.info("[GrammarPointBackfillRunner] Claude API 미설정 — 문법 포인트 백필 건너뜀");
            return;
        }

        Set<Long> songIdsWithPoints = grammarPointRepository.findAll().stream()
                .map(gp -> gp.getSong().getId())
                .collect(Collectors.toSet());

        List<Song> missing = songRepository.findAll().stream()
                .filter(s -> !songIdsWithPoints.contains(s.getId()))
                .limit(MAX_SONGS_PER_STARTUP)
                .toList();
        if (missing.isEmpty()) {
            return;
        }

        log.info("[GrammarPointBackfillRunner] 문법 포인트 없는 곡 {}건 백필 시작", missing.size());
        int filled = 0;
        for (Song song : missing) {
            List<SongLine> lines = songLineRepository.findBySongIdOrderByLineOrderAsc(song.getId());
            if (lines.isEmpty()) {
                continue;
            }
            if (!grammarPointService.generateForSong(song, lines).isEmpty()) {
                filled++;
            }
        }
        log.info("[GrammarPointBackfillRunner] 백필 완료 — {}곡에 문법 포인트 생성"
                + "(가사 없음/API 실패 등으로 일부는 건너뜀)", filled);
    }
}
