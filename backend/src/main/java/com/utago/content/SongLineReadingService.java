package com.utago.content;

import com.utago.common.Lang;
import com.utago.dictionary.SongLineWord;
import com.utago.dictionary.SongLineWordRepository;
import com.utago.nlp.JapaneseTokenizerService;
import com.utago.nlp.JapaneseTokenizerService.ReadingToken;
import com.utago.nlp.KanaToHangulConverter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 소절의 "모국어 발음 표기"(SongLineReading)를 자동 생성한다. 지금은 일본어(JA) 원어
 * 곡 → 한국어(KO) 발음 표기만 지원한다(KanaToHangulConverter가 히라가나→한글 음차만
 * 다루므로). 곡 등록 시(SongService, 실시간) / 서버 기동 시 백필(SongLineReadingBackfillRunner)
 * 양쪽에서 재사용 — 로직 중복 방지용 공통 컴포넌트.
 *
 * AI 호출 없이 Kuromoji(형태소 분석) + 순수 규칙 기반 음차 변환만 쓰므로 비용/지연이 없다.
 *
 * 두 가지를 신경 쓴다:
 * 1) 발음 일치 — 한자는 문맥에 따라 Kuromoji가 다른 읽기(음독/훈독)를 고를 수 있다(예: 君을
 *    "フラッシュ君" 뒤에서는 접미사 "쿤"으로 분석함). 이미 단어장/후리가나(ruby)에 쓰이고
 *    있는 Word.reading이 있으면 그걸 그대로 재사용해서, 화면에 보이는 후리가나와 줄 전체
 *    발음 표기가 서로 어긋나지 않게 한다.
 * 2) 읽기 좋은 띄어쓰기 — 형태소를 문절(자립어 하나 + 뒤에 붙는 조사/조동사/접미사) 단위로
 *    묶어서 구간마다 띄어 쓴다. サ変명사(공격/사랑 등) 바로 뒤에 오는 する 활용형은 명사와
 *    한 문절로 합친다("攻撃して" -> "공격해서", 붙여 쓰지 않으면 "공격 해서"처럼 어색해짐).
 */
@Service
@RequiredArgsConstructor
public class SongLineReadingService {

    private final JapaneseTokenizerService japaneseTokenizerService;
    private final KanaToHangulConverter kanaToHangulConverter;
    private final SongLineReadingRepository songLineReadingRepository;
    private final SongLineWordRepository songLineWordRepository;

    /**
     * 주어진 일본어 소절들 중 아직 KO 발음 표기가 없는 것만 생성해서 저장한다.
     * @param lines 원어가 JA인 곡의 소절 목록(호출자 책임 — 여기서는 원어를 다시 확인하지 않는다).
     * @return 실제로 생성/저장된 발음 표기 수
     */
    public int generateKoReadings(List<SongLine> lines) {
        if (lines == null || lines.isEmpty()) {
            return 0;
        }
        List<Long> lineIds = lines.stream().map(SongLine::getId).toList();
        Set<Long> haveReading = songLineReadingRepository
                .findBySongLineIdInAndTargetLang(lineIds, Lang.KO).stream()
                .map(r -> r.getSongLine().getId())
                .collect(Collectors.toSet());

        List<SongLine> needGeneration = lines.stream()
                .filter(l -> !haveReading.contains(l.getId()))
                .toList();
        if (needGeneration.isEmpty()) {
            return 0;
        }

        List<Long> needLineIds = needGeneration.stream().map(SongLine::getId).toList();
        Map<Long, List<SongLineWord>> wordsByLineId = songLineWordRepository.findBySongLineIdIn(needLineIds).stream()
                .collect(Collectors.groupingBy(w -> w.getSongLine().getId()));

        List<SongLineReading> toSave = new ArrayList<>();
        for (SongLine line : needGeneration) {
            List<SongLineWord> words = wordsByLineId.getOrDefault(line.getId(), List.of());
            String hiraganaReading = buildLineHiraganaReading(line.getOriginalText(), words);
            String hangul = kanaToHangulConverter.convert(hiraganaReading);
            if (hangul == null || hangul.isBlank()) {
                continue;
            }
            toSave.add(SongLineReading.builder()
                    .songLine(line)
                    .targetLang(Lang.KO)
                    .readingText(hangul)
                    .build());
        }
        if (!toSave.isEmpty()) {
            songLineReadingRepository.saveAll(toSave);
        }
        return toSave.size();
    }

    /**
     * generateKoReadings와 달리, 이미 발음 표기가 있는 소절도 전부 다시 계산해서 달라진
     * 것만 덮어쓴다. 변환 규칙 자체가 바뀌었을 때(예: 조사 は/を/へ 발음 특례 추가) 이미
     * 저장된 캐시를 바로잡는 용도 — SongLineReadingRepairRunner에서 서버 기동마다 호출.
     * @return 실제로 값이 바뀌어서 덮어쓴 표기 수
     */
    public int repairKoReadings(List<SongLine> lines) {
        if (lines == null || lines.isEmpty()) {
            return 0;
        }
        List<Long> lineIds = lines.stream().map(SongLine::getId).toList();
        Map<Long, SongLineReading> existingByLineId = songLineReadingRepository
                .findBySongLineIdInAndTargetLang(lineIds, Lang.KO).stream()
                .collect(Collectors.toMap(r -> r.getSongLine().getId(), r -> r));
        if (existingByLineId.isEmpty()) {
            return 0;
        }

        Map<Long, List<SongLineWord>> wordsByLineId = songLineWordRepository.findBySongLineIdIn(lineIds).stream()
                .collect(Collectors.groupingBy(w -> w.getSongLine().getId()));

        List<SongLineReading> toSave = new ArrayList<>();
        for (SongLine line : lines) {
            SongLineReading existing = existingByLineId.get(line.getId());
            if (existing == null) {
                continue;
            }
            List<SongLineWord> words = wordsByLineId.getOrDefault(line.getId(), List.of());
            String hiraganaReading = buildLineHiraganaReading(line.getOriginalText(), words);
            String hangul = kanaToHangulConverter.convert(hiraganaReading);
            if (hangul == null || hangul.isBlank() || hangul.equals(existing.getReadingText())) {
                continue;
            }
            existing.setReadingText(hangul);
            toSave.add(existing);
        }
        if (!toSave.isEmpty()) {
            songLineReadingRepository.saveAll(toSave);
        }
        return toSave.size();
    }

    /**
     * 소절 원문을 문절 단위로 띄어 쓴 히라가나 읽기로 재구성한다. 이미 단어(SongLineWord)로
     * 등록된 구간은 그 단어에 연결된 Word.reading(있으면)을 그대로 쓰고, 없으면 형태소
     * 분석기가 이번에 계산한 읽기를 쓴다.
     */
    private String buildLineHiraganaReading(String text, List<SongLineWord> words) {
        Map<Integer, SongLineWord> wordByStart = new HashMap<>();
        for (SongLineWord w : words) {
            wordByStart.put(w.getCharOffsetStart(), w);
        }

        List<ReadingToken> tokens = japaneseTokenizerService.analyzeForReading(text);

        StringBuilder sb = new StringBuilder(text.length() + 8);
        boolean chunkStarted = false;
        boolean prevWasSaHenNoun = false;

        for (ReadingToken token : tokens) {
            SongLineWord matchedWord = wordByStart.get(token.charOffsetStart());
            boolean hasWordMatch = matchedWord != null
                    && matchedWord.getCharOffsetEnd() == token.charOffsetEnd();

            String reading;
            if (hasWordMatch && matchedWord.getWord() != null
                    && matchedWord.getWord().getReading() != null
                    && !matchedWord.getWord().getReading().isBlank()) {
                reading = matchedWord.getWord().getReading();
            } else {
                reading = token.reading();
            }
            // 캐시된 Word.reading을 재사용하는 경우에도, 동형이의어 보정 규칙(예: 止める ->
            // とめる/やめる)은 매번 문맥에 맞게 다시 적용한다 — 캐시가 만들어진 시점의 문맥과
            // 지금 이 줄의 문맥이 다를 수 있기 때문(같은 단어가 다른 곡/문맥에서 재사용됨).
            reading = japaneseTokenizerService.applyHomographOverride(
                    token.baseForm(), reading, text.substring(token.charOffsetEnd()));

            boolean isSuruContinuation = "動詞".equals(token.partOfSpeechLevel1())
                    && "する".equals(token.baseForm())
                    && prevWasSaHenNoun;
            boolean startsNewChunk = token.isIndependent() && !isSuruContinuation;

            if (startsNewChunk && chunkStarted) {
                sb.append(' ');
            }
            sb.append(reading);
            chunkStarted = true;

            prevWasSaHenNoun = "名詞".equals(token.partOfSpeechLevel1())
                    && "サ変接続".equals(token.partOfSpeechLevel2());
        }
        return sb.toString();
    }
}
