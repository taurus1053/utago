package com.utago.grammar;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.utago.ai.AnthropicClient;
import com.utago.common.Lang;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * 곡과 무관한 "문법 사전"(GrammarEntry) 마스터 데이터를 다루는 서비스 — claude/기획_정리.md,
 * 2026-10-08 "노래 속 문법 말고 기본 문법도 공부하게 해달라" 요청으로 신설.
 *
 * 두 가지 역할:
 * 1) generateForLevel — 레벨 하나(N5~N1)를 통째로 AI에 맡겨 한 번에 채운다
 *    (GrammarEntrySeedRunner가 서버 기동 시 호출).
 * 2) findOrCreateEntry — GrammarPointService가 곡의 문법 포인트를 뽑을 때, 같은 패턴이 이미
 *    문법 사전에 있으면 그 항목에 연결하고, 없으면 새로 만들어 연결한다. 이렇게 하면 곡을
 *    등록할 때마다 문법 사전이 자연스럽게 풍부해지고, 문법 상세 화면에서 "이 문법이 쓰인
 *    노래"를 역으로 찾을 수 있다.
 */
@Service
@RequiredArgsConstructor
public class GrammarEntryService {

    private static final Logger log = LoggerFactory.getLogger(GrammarEntryService.class);

    /** 레벨 하나당 한 번에 생성할 문법 항목 개수. */
    private static final int ENTRIES_PER_LEVEL = 20;

    private final AnthropicClient anthropicClient;
    private final GrammarEntryRepository grammarEntryRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public boolean isAvailable() {
        return anthropicClient.isConfigured();
    }

    /**
     * 노래 속 문법(GrammarPointService)이 추출한 패턴을 문법 사전과 연결한다. 이미 같은
     * 패턴(공백/대소문자 무시)이 있으면 그걸 재사용하고, 없으면 새로 만들어 저장한다.
     * pattern이 비어있으면 연결할 게 없으므로 null을 돌려준다(호출 측은 그냥 연결 없이 저장).
     */
    @Transactional
    public GrammarEntry findOrCreateEntry(Lang lang, String pattern, String meaning,
                                           GrammarLevel level, String explanation) {
        if (pattern == null || pattern.isBlank()) {
            return null;
        }
        Optional<GrammarEntry> existing = grammarEntryRepository.findByLangAndNormalizedPattern(lang, pattern);
        if (existing.isPresent()) {
            return existing.get();
        }
        GrammarEntry entry = GrammarEntry.builder()
                .lang(lang)
                // 곡 맥락에서는 레벨 추정이 빗나갈 수 있어, 못 받으면 중간값(N3)으로 폴백.
                .level(level != null ? level : GrammarLevel.N3)
                .pattern(pattern.trim())
                .meaning(meaning != null && !meaning.isBlank() ? meaning.trim() : pattern.trim())
                .explanation(explanation != null ? explanation : "")
                .build();
        return grammarEntryRepository.save(entry);
    }

    /**
     * 레벨 하나를 통째로 AI에게 맡겨 핵심 문법 ENTRIES_PER_LEVEL개를 생성/저장한다. 이미 있는
     * 패턴(다른 경로로 먼저 생겼을 수 있음 — findOrCreateEntry 참고)은 건너뛴다.
     */
    @Transactional
    public List<GrammarEntry> generateForLevel(GrammarLevel level) {
        if (!anthropicClient.isConfigured()) {
            return List.of();
        }
        String prompt = buildPrompt(level);
        Optional<String> raw = anthropicClient.complete(prompt, 4000);
        if (raw.isEmpty()) {
            return List.of();
        }

        List<ParsedEntry> parsed = parse(raw.get());
        if (parsed.isEmpty()) {
            return List.of();
        }

        List<GrammarEntry> saved = new ArrayList<>();
        for (ParsedEntry p : parsed) {
            if (p.pattern() == null || p.pattern().isBlank()
                    || p.meaning() == null || p.meaning().isBlank()
                    || p.explanation() == null || p.explanation().isBlank()) {
                continue;
            }
            if (grammarEntryRepository.findByLangAndNormalizedPattern(Lang.JA, p.pattern()).isPresent()) {
                continue;
            }
            saved.add(grammarEntryRepository.save(GrammarEntry.builder()
                    .lang(Lang.JA)
                    .level(level)
                    .pattern(p.pattern().trim())
                    .meaning(p.meaning().trim())
                    .explanation(p.explanation().trim())
                    .structure(p.structure())
                    .exampleSentence(p.exampleSentence())
                    .exampleTranslation(p.exampleTranslation())
                    .build()));
        }
        log.info("[GrammarEntryService] {} 레벨 문법 {}건 생성", level, saved.size());
        return saved;
    }

    private record ParsedEntry(
            String pattern, String meaning, String explanation,
            String structure, String exampleSentence, String exampleTranslation
    ) {}

    private String buildPrompt(GrammarLevel level) {
        StringBuilder sb = new StringBuilder();
        sb.append("너는 일본어(JLPT) 문법 교재 편집자다. JLPT ").append(level).append(" 수준의 핵심 문법 패턴을 ");
        sb.append("정확히 ").append(ENTRIES_PER_LEVEL).append("개 뽑아라. 그 레벨 교재에 실제로 나오는 ");
        sb.append("대표적이고 중요한 패턴 위주로, 서로 겹치지 않게 골라라. ");
        sb.append("각 항목은 다음 필드를 가진 JSON 객체여야 한다: ");
        sb.append("pattern(문법 패턴 표제, 예: \"〜ている\"), ");
        sb.append("meaning(한국어로 짧은 뜻 한 줄), ");
        sb.append("explanation(한국어로 2~3문장, 용법/뉘앙스 설명), ");
        sb.append("structure(접속 형태, 예: \"동사 て형 + いる\"), ");
        sb.append("exampleSentence(이 문법이 쓰인 일본어 예문 한 문장), ");
        sb.append("exampleTranslation(그 예문의 한국어 번역). ");
        sb.append("반드시 JSON 배열로만 응답하고, 다른 설명이나 마크다운, 코드블록 표시 없이 순수 JSON만 출력하라.");
        return sb.toString();
    }

    private List<ParsedEntry> parse(String text) {
        try {
            int start = text.indexOf('[');
            int end = text.lastIndexOf(']');
            String json = (start >= 0 && end > start) ? text.substring(start, end + 1) : text;
            JsonNode node = objectMapper.readTree(json);
            if (!node.isArray()) {
                return List.of();
            }
            List<ParsedEntry> out = new ArrayList<>();
            for (JsonNode inner : node) {
                out.add(new ParsedEntry(
                        inner.path("pattern").asText(null),
                        inner.path("meaning").asText(null),
                        inner.path("explanation").asText(null),
                        inner.path("structure").asText(null),
                        inner.path("exampleSentence").asText(null),
                        inner.path("exampleTranslation").asText(null)
                ));
                if (out.size() >= ENTRIES_PER_LEVEL) {
                    break;
                }
            }
            return out;
        } catch (Exception e) {
            log.warn("[GrammarEntryService] 응답 파싱 실패: {}", e.getMessage());
            return List.of();
        }
    }
}
