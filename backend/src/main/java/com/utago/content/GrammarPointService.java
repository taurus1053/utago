package com.utago.content;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.utago.ai.AnthropicClient;
import com.utago.common.Lang;
import com.utago.grammar.GrammarEntry;
import com.utago.grammar.GrammarEntryService;
import com.utago.grammar.GrammarLevel;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 가사 원문을 보고 "이 곡에서 실제로 쓰인 핵심 문법 포인트"를 AI로 뽑아내는 서비스 —
 * claude/소셜_마이페이지_기획.md 11-2번에 "다음에 정교화" 메모로만 남아있던 문법 기능을
 * 실제로 채운다(GrammarPoint 엔티티/프론트 표시(SongLearn.jsx "이 곡의 문법 포인트" 카드)는
 * 서비스 초기부터 이미 있었는데, 실제로 데이터를 채워 넣는 쪽이 통째로 빠져 있었음).
 *
 * TranslationService와 같은 "있으면 좋고 없어도 그만" 성격 — Claude API 키가 없거나 호출이
 * 실패해도 예외를 던지지 않고 빈 리스트를 돌려준다. 곡 등록/수정 자체는 그대로 성공한다.
 *
 * (2026-10-08) 곡과 무관한 "문법 사전"(GrammarEntry, com.utago.grammar) 신설에 맞춰, 여기서
 * 뽑은 패턴을 사전과 매칭/연결하는 역할도 같이 한다 — 이 프롬프트에서 meaning/level까지 함께
 * 받아서, 사전에 없는 새 패턴이면 GrammarEntryService.findOrCreateEntry가 그 자리에서 새로
 * 만든다(품질은 레벨 추정 등 다소 거칠 수 있음 — GrammarEntryService의 레벨별 전용 생성이
 * 더 정교한 1차 데이터이고, 이쪽은 "곡에 쓰였는데 아직 사전에 없는" 패턴을 놓치지 않는 보완책).
 */
@Service
@RequiredArgsConstructor
public class GrammarPointService {

    private static final Logger log = LoggerFactory.getLogger(GrammarPointService.class);

    /** 한 번의 Claude 호출에 보낼 최대 소절 수 — TranslationService와 같은 상한을 그대로 씀. */
    private static final int MAX_LINES_PER_REQUEST = 60;
    /** 곡 하나당 뽑을 문법 포인트 최대 개수 — 너무 많으면 화면이 길어지고 학습자가 부담스러움. */
    private static final int MAX_POINTS = 8;

    private final AnthropicClient anthropicClient;
    private final GrammarPointRepository grammarPointRepository;
    private final GrammarEntryService grammarEntryService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public boolean isAvailable() {
        return anthropicClient.isConfigured();
    }

    /**
     * 가사 전체(최대 MAX_LINES_PER_REQUEST줄)를 Claude에 보내 핵심 문법 패턴을 추출하고
     * 저장한 뒤 돌려준다. 실패/미설정 시 아무것도 저장하지 않고 빈 리스트.
     */
    @Transactional
    public List<GrammarPoint> generateForSong(Song song, List<SongLine> lines) {
        if (!anthropicClient.isConfigured() || lines == null || lines.isEmpty()) {
            return List.of();
        }
        List<SongLine> trimmed = lines.size() > MAX_LINES_PER_REQUEST
                ? lines.subList(0, MAX_LINES_PER_REQUEST)
                : lines;

        String prompt = buildPrompt(song.getSourceLang(), trimmed);
        Optional<String> raw = anthropicClient.complete(prompt, 2000);
        if (raw.isEmpty()) {
            return List.of();
        }

        List<ParsedPoint> parsed = parse(raw.get());
        if (parsed.isEmpty()) {
            return List.of();
        }

        Map<Integer, SongLine> lineByOrder = new HashMap<>();
        for (SongLine l : trimmed) {
            lineByOrder.put(l.getLineOrder(), l);
        }

        List<GrammarPoint> toSave = new ArrayList<>();
        for (ParsedPoint p : parsed) {
            if (p.pattern() == null || p.pattern().isBlank()
                    || p.explanation() == null || p.explanation().isBlank()) {
                continue;
            }
            SongLine example = p.exampleLineOrder() != null ? lineByOrder.get(p.exampleLineOrder()) : null;
            GrammarEntry entry = grammarEntryService.findOrCreateEntry(
                    song.getSourceLang(), p.pattern(), p.meaning(), parseLevel(p.level()), p.explanation());
            toSave.add(GrammarPoint.builder()
                    .song(song)
                    .pattern(p.pattern().trim())
                    .explanation(p.explanation().trim())
                    .exampleSongLine(example)
                    .grammarEntry(entry)
                    .build());
        }
        if (toSave.isEmpty()) {
            return List.of();
        }
        return grammarPointRepository.saveAll(toSave);
    }

    /**
     * 가사 내용이 바뀐 뒤 재생성 — 기존 문법 포인트를 전부 지우고 새로 뽑는다. 수정된 소절만
     * 보면 맥락을 잃으므로 항상 곡 전체 가사(lines)를 다시 넘겨받는다(SongService.
     * updateLineContent 참고).
     */
    @Transactional
    public List<GrammarPoint> regenerateForSong(Song song, List<SongLine> lines) {
        List<GrammarPoint> existing = grammarPointRepository.findBySongId(song.getId());
        if (!existing.isEmpty()) {
            grammarPointRepository.deleteAll(existing);
        }
        return generateForSong(song, lines);
    }

    private record ParsedPoint(
            String pattern, String explanation, Integer exampleLineOrder, String meaning, String level
    ) {}

    /** AI가 N5~N1 밖의 값을 주거나 비워도 findOrCreateEntry가 폴백(N3)하도록 null을 돌려준다. */
    private GrammarLevel parseLevel(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return GrammarLevel.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private String buildPrompt(Lang sourceLang, List<SongLine> lines) {
        String langName = switch (sourceLang) {
            case JA -> "일본어";
            case EN -> "영어";
            case KO -> "한국어";
        };
        StringBuilder sb = new StringBuilder();
        sb.append("다음은 노래 가사(").append(langName).append(" 원문)를 소절 번호와 함께 나열한 것이다. ");
        sb.append("이 가사에 실제로 쓰인 핵심 문법/표현 패턴을 초중급 학습자 기준으로 최대 ")
                .append(MAX_POINTS).append("개까지 뽑아라. ");
        sb.append("너무 사소하거나 뻔한 것(단순 조사 하나 등)은 빼고, 학습자가 \"아 이 표현이 ");
        sb.append("이런 뜻이구나\" 하고 배울 만한 패턴만 고르며, 같은 패턴이 여러 번 나와도 한 번만 설명하라. ");
        sb.append("각 패턴마다, 그 패턴이 실제로 등장하는 소절 번호(1부터 시작) 중 설명하기 가장 좋은 ");
        sb.append("하나를 exampleLineOrder로 골라라(마땅한 게 없으면 null). ");
        sb.append("설명은 한국어로 2~3문장 이내로 간결하게, 그 가사 맥락에서 어떤 뜻으로 쓰였는지 위주로 써라. ");
        sb.append("추가로 meaning(한국어로 짧은 사전적 뜻 한 줄, 가사 맥락과 무관하게)과 ");
        sb.append("level(이 패턴의 JLPT 난이도 추정, \"N5\"~\"N1\" 중 하나)도 함께 달아라. ");
        sb.append("반드시 JSON 배열로만 응답하고, 각 원소는 {\"pattern\":\"...\",\"explanation\":\"...\",");
        sb.append("\"exampleLineOrder\":1,\"meaning\":\"...\",\"level\":\"N4\"} 형태여야 한다. ");
        sb.append("다른 설명, 마크다운, 코드블록 표시 없이 순수 JSON 배열만 출력하라.\n\n");
        for (SongLine l : lines) {
            sb.append(l.getLineOrder()).append(". ").append(l.getOriginalText()).append("\n");
        }
        return sb.toString();
    }

    private List<ParsedPoint> parse(String text) {
        try {
            int start = text.indexOf('[');
            int end = text.lastIndexOf(']');
            String json = (start >= 0 && end > start) ? text.substring(start, end + 1) : text;
            JsonNode node = objectMapper.readTree(json);
            if (!node.isArray()) {
                return List.of();
            }
            List<ParsedPoint> out = new ArrayList<>();
            for (JsonNode inner : node) {
                String pattern = inner.path("pattern").asText(null);
                String explanation = inner.path("explanation").asText(null);
                JsonNode exampleNode = inner.path("exampleLineOrder");
                Integer exampleLineOrder = (!exampleNode.isMissingNode() && !exampleNode.isNull())
                        ? exampleNode.asInt()
                        : null;
                String meaning = inner.path("meaning").asText(null);
                String level = inner.path("level").asText(null);
                out.add(new ParsedPoint(pattern, explanation, exampleLineOrder, meaning, level));
                if (out.size() >= MAX_POINTS) {
                    break;
                }
            }
            return out;
        } catch (Exception e) {
            log.warn("[GrammarPointService] 응답 파싱 실패: {}", e.getMessage());
            return List.of();
        }
    }
}
