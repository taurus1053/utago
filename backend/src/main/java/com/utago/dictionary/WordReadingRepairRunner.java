package com.utago.dictionary;

import com.utago.common.Lang;
import com.utago.nlp.JapaneseTokenizerService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

/**
 * 서버 기동 시마다, 이미 등록된 일본어 Word들의 읽기(reading)가 "사전형(baseForm) 그대로의
 * 읽기"와 일치하는지 다시 검사해서 틀린 것만 고쳐준다.
 *
 * 왜 필요한가 — 예전에는 Word.reading을 단어가 처음 등장한 가사 줄 속 "활용형(surface)"의
 * 읽기로 채운 적이 있었다(SongService, JapaneseTokenizerService.TokenSpan.furigana 참고).
 * 예를 들어 "繋いで"라는 활용형에서 뽑으면 baseForm은 "繋ぐ"인데 reading은 그 활용형의
 * 읽기("つない…")가 저장돼버려서, 사전형 단어 繋ぐ 옆에 잘못된 읽기 つない가 표시되는
 * 버그가 생겼다. 이건 SQL 마이그레이션만으로는 못 고친다(일본어 형태소 분석이 필요) —
 * 그래서 매 기동마다 Kuromoji로 baseForm을 다시 분석해서 올바른 사전형 읽기로 덮어쓴다.
 *
 * 멱등적 — 이미 올바른 읽기는 건드리지 않으므로(비교 후 다르면만 갱신) 매 기동마다 실행해도
 * 안전하고 비용도 적다.
 */
@Component
@RequiredArgsConstructor
@Order(1) // DictionaryBackfillRunner(뜻 채우기)보다 먼저 — 읽기부터 바로잡고 뜻을 채우는 순서가 자연스러움
public class WordReadingRepairRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(WordReadingRepairRunner.class);

    private final WordRepository wordRepository;
    private final JapaneseTokenizerService japaneseTokenizerService;

    @Override
    @Transactional
    public void run(String... args) {
        List<Word> japaneseWords = wordRepository.findByLang(Lang.JA);
        if (japaneseWords.isEmpty()) {
            return;
        }

        int fixed = 0;
        for (Word word : japaneseWords) {
            String correctReading = japaneseTokenizerService.readingForLemma(word.getLemma());
            if (correctReading == null || correctReading.isEmpty()) {
                continue; // 한자가 없거나 분석 실패 — 기존 값 유지
            }
            if (!Objects.equals(word.getReading(), correctReading)) {
                word.setReading(correctReading);
                fixed++;
            }
        }

        if (fixed > 0) {
            wordRepository.saveAll(japaneseWords);
            log.info("[WordReadingRepairRunner] 사전형 읽기 불일치 {}건 복구", fixed);
        }
    }
}
