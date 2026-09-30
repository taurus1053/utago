package com.utago.home;

import com.utago.content.Song;
import com.utago.content.SongLine;
import com.utago.content.SongLineRepository;
import com.utago.dictionary.SongLineWord;
import com.utago.dictionary.SongLineWordRepository;
import com.utago.dictionary.Word;
import com.utago.dictionary.WordMeaning;
import com.utago.dictionary.WordMeaningRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 홈 화면 "오늘의 가사" / "가사 복습하기" 카드용 서비스.
 * 두 기능 모두 가사 소절(SongLine) 하나 + 그 안에 등장하는 단어들의 뜻을 함께 내려준다는
 * 점이 같아서(toResponse), 소절을 무작위로 고르는 방식만 다르게 조합한다:
 * - 오늘의 가사: 단어장과 무관하게 공개 가사 전체에서 무작위 소절.
 * - 가사 복습하기: 내 단어장에 담긴 단어가 실제로 등장하는 소절 중 무작위.
 * 두 경우 모두 다른 사용자의 PRIVATE 곡 가사가 섞이지 않도록 SongLineRepository의
 * 가시성 필터(공개+게시됨 또는 본인 소유)를 그대로 쓴다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HomeLyricService {

    private final SongLineRepository songLineRepository;
    private final SongLineWordRepository songLineWordRepository;
    private final WordMeaningRepository wordMeaningRepository;

    public Optional<LyricLineResponse> getRandomLyricOfDay(Long userId) {
        return songLineRepository.findRandomVisibleLine(userId).map(this::toResponse);
    }

    public Optional<LyricLineResponse> getRandomLyricReview(Long userId) {
        return songLineRepository.findRandomReviewLineForUser(userId).map(this::toResponse);
    }

    private LyricLineResponse toResponse(SongLine line) {
        List<SongLineWord> slws = songLineWordRepository.findBySongLineId(line.getId());
        List<Long> wordIds = slws.stream().map(slw -> slw.getWord().getId()).distinct().toList();
        Map<Long, List<WordMeaning>> meaningsByWordId = wordMeaningRepository
                .findByWordIdInOrderByDisplayOrderAsc(wordIds).stream()
                .collect(Collectors.groupingBy(m -> m.getWord().getId()));

        List<LyricWordSpan> words = slws.stream()
                .sorted((a, b) -> Integer.compare(a.getCharOffsetStart(), b.getCharOffsetStart()))
                .map(slw -> {
                    Word w = slw.getWord();
                    List<String> meanings = meaningsByWordId.getOrDefault(w.getId(), List.of()).stream()
                            .map(WordMeaning::getMeaningText)
                            .toList();
                    return new LyricWordSpan(
                            w.getId(), w.getLemma(), w.getLang(), w.getReading(), meanings,
                            slw.getCharOffsetStart(), slw.getCharOffsetEnd()
                    );
                })
                .toList();

        Song song = line.getSong();
        return new LyricLineResponse(
                line.getId(), song.getId(), song.getTitle(), song.getArtist(),
                line.getOriginalText(), line.getTranslationNatural(), words
        );
    }
}
