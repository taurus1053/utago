package com.utago.dictionary;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * JMdict(EDRDG, CC BY-SA 3.0) 상용어(common word) 부분집합을 앱 리소스로 내장해서, 쿠로모지가
 * 추출한 단어(기본형/읽기)에 대응하는 JMdict 표제어(한자형/가나형 + 영어 뜻 원문)를 찾아준다.
 *
 * 여기서 나오는 영어 뜻은 그대로 사용자에게 보여주지 않는다 — TranslationService로 한국어
 * 사전식 뜻으로 변환한 뒤에만 WordMeaning에 저장한다(WordMeaningEnrichmentService 참고).
 *
 * 데이터 출처: jamdict-data(파이썬 PyPI 패키지)에 번들된 JMdict 스냅샷에서, 우선순위 태그
 * (news1/ichi1/spec1/gai1 등)가 붙은 "상용어"만 약 3만 건 추출 — 노래 가사에 자주 나올 법한
 * 어휘 범위로 충분하며, 전체(약 20만 건)를 다 담으면 리소스 용량과 AI 번역 비용이 과해짐.
 *
 * [라이선스 주의] JMdict는 CC BY-SA 3.0 — 이 데이터를 활용하는 이상 출처(EDRDG/JMdict)를
 * 앱 어딘가(정보/크레딧 화면 등)에 명시해야 한다. 아직 미구현 — 기획 문서 8번 열린 질문 참고.
 */
@Component
public class JMdictLookupService {

    private static final Logger log = LoggerFactory.getLogger(JMdictLookupService.class);
    private static final String RESOURCE_PATH = "/dictionary/jmdict_common_en.json";

    public record Sense(String pos, List<String> glossesEn) {}

    public record Entry(List<String> kanji, List<String> kana, List<Sense> senses) {}

    private final ObjectMapper objectMapper = new ObjectMapper();
    private Map<String, List<Entry>> byKey = Map.of();
    private List<Entry> allEntries = List.of();

    @PostConstruct
    void load() {
        try (InputStream in = getClass().getResourceAsStream(RESOURCE_PATH)) {
            if (in == null) {
                log.warn("[JMdictLookupService] 리소스 파일을 찾을 수 없음: {} — 단어 뜻 자동 채우기 비활성화", RESOURCE_PATH);
                return;
            }
            List<RawEntry> raw = objectMapper.readValue(in,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, RawEntry.class));

            Map<String, List<Entry>> map = new HashMap<>();
            List<Entry> entries = new ArrayList<>(raw.size());
            for (RawEntry r : raw) {
                List<String> kanjiForms = r.k == null ? List.of() : r.k;
                List<String> kanaForms = r.r == null ? List.of() : r.r;
                List<Sense> senses = r.s == null
                        ? List.of()
                        : r.s.stream()
                                .map(s -> new Sense(s.pos, s.gl == null ? List.of() : s.gl))
                                .toList();
                Entry entry = new Entry(kanjiForms, kanaForms, senses);
                entries.add(entry);

                for (String key : kanjiForms) {
                    map.computeIfAbsent(key, k -> new ArrayList<>()).add(entry);
                }
                for (String key : kanaForms) {
                    map.computeIfAbsent(key, k -> new ArrayList<>()).add(entry);
                }
            }
            this.byKey = map;
            this.allEntries = entries;
            log.info("[JMdictLookupService] JMdict 상용어 {}건 로드 완료 ({}개 표제 키)", raw.size(), map.size());
        } catch (Exception e) {
            log.error("[JMdictLookupService] JMdict 리소스 로드 실패 — 단어 뜻 자동 채우기 비활성화", e);
        }
    }

    /**
     * 사전 단어 미리 채우기(DictionarySeedService)에서 쓰는 전체 표제어 목록(약 3만 건,
     * JSON 등장 순서). byKey처럼 표기별로 중복되지 않은, 표제어 1건당 1개의 원본 목록이다.
     */
    public List<Entry> allEntries() {
        return allEntries;
    }

    /**
     * 기본형(한자 또는 가나 표기) 우선, 없으면 읽기(가나)로 재시도.
     *
     * 같은 표기(특히 가나만 있는 짧은 단어)를 여러 표제어가 공유할 수 있다 — 예를 들어
     * "ない"는 無い(없다, 아주 흔한 단어)의 기본 읽기이기도 하지만, 地震(지진, じしん)의
     * 드문 이체 읽기 중 하나이기도 하다. 무작정 JSON 등장 순서상 첫 번째를 고르면(地震가
     * 먼저 나올 경우) 완전히 엉뚱한 뜻이 나온다. 그래서 여러 표제어가 매칭되면, 검색 키가
     * 그 표제어의 "대표 읽기"(읽기 목록의 첫 번째)와 정확히 같은 것을 우선한다 — 無い처럼
     * 그 표기가 주된 읽기인 단어를, 地震처럼 부차적으로만 그 표기를 갖는 단어보다 우선.
     */
    public Optional<Entry> lookup(String lemma, String reading) {
        Optional<Entry> byLemma = lookupPreferPrimaryReading(lemma);
        if (byLemma.isPresent()) {
            return byLemma;
        }
        if (reading != null && !reading.isBlank()) {
            return lookupPreferPrimaryReading(reading);
        }
        return Optional.empty();
    }

    private Optional<Entry> lookupPreferPrimaryReading(String key) {
        List<Entry> candidates = byKey.get(key);
        if (candidates == null || candidates.isEmpty()) {
            return Optional.empty();
        }
        for (Entry e : candidates) {
            if (!e.kana().isEmpty() && key.equals(e.kana().get(0))) {
                return Optional.of(e);
            }
        }
        return Optional.of(candidates.get(0));
    }

    static class RawEntry {
        public List<String> k;
        public List<String> r;
        public List<RawSense> s;
    }

    static class RawSense {
        public String pos;
        public List<String> gl;
    }
}
