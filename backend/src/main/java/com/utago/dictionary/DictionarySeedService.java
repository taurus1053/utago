package com.utago.dictionary;

import com.utago.common.Lang;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 단어장 "단어 추가" 화면에서 처음 입력하는 단어도 바로바로 뜻이 채워지도록, JMdict
 * 상용어(약 3만 건)를 마스터 사전(Word/WordMeaning)에 미리 만들어둔다 — 관리자가 필요할 때
 * (AdminDictionaryController) 배치 단위로 호출해서 조금씩 채워나가는 방식.
 *
 * [비용 주의] 한 단어당 Claude API 호출(여러 단어를 묶어서 보내므로 실제로는 수십 단어당
 * 1회)이 들어간다 — 3만 건을 한 번에 다 돌리면 비용이 꽤 나갈 수 있어서 자동 실행하지
 * 않고, 관리자가 batchSize를 정해서 여러 번 나눠 호출하도록 설계했다(멱등적 — 이미 만든
 * 단어는 건너뛰므로 몇 번을 호출해도 안전).
 */
@Service
@RequiredArgsConstructor
public class DictionarySeedService {

    private static final Logger log = LoggerFactory.getLogger(DictionarySeedService.class);

    private final JMdictLookupService jmdictLookupService;
    private final WordRepository wordRepository;
    private final WordMeaningEnrichmentService wordMeaningEnrichmentService;

    /**
     * @param batchSize 이번 호출에서 새로 만들 단어 수 상한
     * @return 실제로 새로 만든 단어 수(0이면 더 이상 채울 단어가 없다는 뜻 — "완료")
     */
    @Transactional
    public int seedNextBatch(int batchSize) {
        List<Word> created = new ArrayList<>();
        for (JMdictLookupService.Entry entry : jmdictLookupService.allEntries()) {
            if (created.size() >= batchSize) {
                break;
            }
            String lemma = !entry.kanji().isEmpty() ? entry.kanji().get(0)
                    : (!entry.kana().isEmpty() ? entry.kana().get(0) : null);
            if (lemma == null || lemma.isBlank()) {
                continue;
            }
            // 이미 있으면 건너뛴다 — 곡 등록/직접 추가로 먼저 생겼을 수도 있고, 지난 번
            // 시딩 호출에서 이미 만들었을 수도 있다. 둘 다 재생성하지 않는다(멱등성).
            if (wordRepository.findByLemmaAndLang(lemma, Lang.JA).isPresent()) {
                continue;
            }
            String reading = entry.kana().isEmpty() ? null : entry.kana().get(0);
            String pos = entry.senses().isEmpty() ? null : entry.senses().get(0).pos();
            if (pos != null && pos.length() > 30) {
                pos = pos.substring(0, 30);
            }
            created.add(Word.builder()
                    .lemma(lemma)
                    .lang(Lang.JA)
                    .reading(reading)
                    .pos(pos)
                    .dictSource("JMdict")
                    .build());
        }
        if (created.isEmpty()) {
            return 0;
        }
        wordRepository.saveAll(created);
        int filled = wordMeaningEnrichmentService.enrich(created);
        log.info("[DictionarySeedService] 단어 {}건 새로 생성, 뜻 {}건 채움", created.size(), filled);
        return created.size();
    }
}
