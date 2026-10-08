package com.utago.grammar;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * 서버 기동 시, 아직 비어있는 문법 레벨(N5~N1)을 AI로 채운다 — GrammarPointBackfillRunner와
 * 같은 "멱등적 소급 백필" 패턴. 레벨 하나당 Claude 호출이 1번 들어가는데, 기동이 느려지지
 * 않도록 **한 번 기동에 한 레벨만** 채우고 나머지는 다음 기동 때 이어서 처리한다(이미 채워진
 * 레벨은 건드리지 않으므로 매 기동마다 실행해도 안전).
 */
@Component
@RequiredArgsConstructor
public class GrammarEntrySeedRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(GrammarEntrySeedRunner.class);

    // 쉬운 레벨부터 채워서 초반 사용자가 바로 N5/N4 문법을 볼 수 있게 한다.
    private static final GrammarLevel[] ORDER = {
            GrammarLevel.N5, GrammarLevel.N4, GrammarLevel.N3, GrammarLevel.N2, GrammarLevel.N1
    };

    private final GrammarEntryRepository grammarEntryRepository;
    private final GrammarEntryService grammarEntryService;

    @Override
    public void run(String... args) {
        if (!grammarEntryService.isAvailable()) {
            log.info("[GrammarEntrySeedRunner] Claude API 미설정 — 문법 사전 시딩 건너뜀");
            return;
        }
        for (GrammarLevel level : ORDER) {
            if (grammarEntryRepository.countByLevel(level) > 0) {
                continue;
            }
            log.info("[GrammarEntrySeedRunner] {} 레벨 문법 사전이 비어있어 생성 시작", level);
            grammarEntryService.generateForLevel(level);
            // 한 기동에 한 레벨만 — 나머지 빈 레벨은 다음 기동에서 이어서 처리된다.
            return;
        }
    }
}
